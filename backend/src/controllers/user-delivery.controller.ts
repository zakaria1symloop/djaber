import { Request, Response } from 'express';
import prisma from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';
import { wilayas } from '../data/wilayas';
import * as deliveryService from '../services/delivery.service';
import { createNotification } from '../services/notification.service';

// ============================================================================
// Get Wilayas
// ============================================================================

export const getWilayas = async (_req: Request, res: Response): Promise<void> => {
  res.json({ wilayas });
};

// ============================================================================
// Get Available Providers
// ============================================================================

export const getAvailableProviders = async (_req: Request, res: Response): Promise<void> => {
  const providers = deliveryService.getAvailableProviders();
  res.json({ providers });
};

// ============================================================================
// Get User's Configured Providers
// ============================================================================

export const getProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const providers = await prisma.deliveryProvider.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });

    // Don't send encrypted credentials to frontend
    const sanitized = providers.map(p => ({
      ...p,
      credentials: undefined,
      hasCredentials: true,
    }));

    res.json({ providers: sanitized });
  } catch (error) {
    console.error('Get providers error:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
};

// ============================================================================
// Add Provider Configuration
// ============================================================================

export const addProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      provider,
      displayName,
      credentials,
      isDefault,
      senderName,
      senderPhone,
      senderAddress,
      senderWilayaId,
    } = req.body;

    if (!provider || !credentials) {
      res.status(400).json({ error: 'Provider and credentials are required' });
      return;
    }

    const validProviders = ['yalidine', 'zrexpress', 'maystro'];
    if (!validProviders.includes(provider)) {
      res.status(400).json({ error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` });
      return;
    }

    // Check for existing
    const existing = await prisma.deliveryProvider.findUnique({
      where: { userId_provider: { userId: req.user.userId, provider } },
    });

    if (existing) {
      res.status(409).json({ error: `Provider ${provider} is already configured` });
      return;
    }

    // Encrypt credentials
    const encryptedCreds = encrypt(JSON.stringify(credentials));

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.deliveryProvider.updateMany({
        where: { userId: req.user.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const newProvider = await prisma.deliveryProvider.create({
      data: {
        userId: req.user.userId,
        provider,
        displayName: displayName || provider,
        credentials: encryptedCreds,
        isDefault: isDefault || false,
        senderName: senderName || null,
        senderPhone: senderPhone || null,
        senderAddress: senderAddress || null,
        senderWilayaId: senderWilayaId ? Number(senderWilayaId) : null,
      },
    });

    res.status(201).json({
      provider: {
        ...newProvider,
        credentials: undefined,
        hasCredentials: true,
      },
    });
  } catch (error) {
    console.error('Add provider error:', error);
    res.status(500).json({ error: 'Failed to add provider' });
  }
};

// ============================================================================
// Update Provider Configuration
// ============================================================================

export const updateProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const {
      displayName,
      credentials,
      isActive,
      isDefault,
      senderName,
      senderPhone,
      senderAddress,
      senderWilayaId,
    } = req.body;

    const existing = await prisma.deliveryProvider.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }

    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (senderName !== undefined) updateData.senderName = senderName || null;
    if (senderPhone !== undefined) updateData.senderPhone = senderPhone || null;
    if (senderAddress !== undefined) updateData.senderAddress = senderAddress || null;
    if (senderWilayaId !== undefined) updateData.senderWilayaId = senderWilayaId ? Number(senderWilayaId) : null;

    if (credentials) {
      updateData.credentials = encrypt(JSON.stringify(credentials));
    }

    if (isDefault) {
      await prisma.deliveryProvider.updateMany({
        where: { userId: req.user.userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
      updateData.isDefault = true;
    } else if (isDefault === false) {
      updateData.isDefault = false;
    }

    const updated = await prisma.deliveryProvider.update({
      where: { id },
      data: updateData,
    });

    res.json({
      provider: {
        ...updated,
        credentials: undefined,
        hasCredentials: true,
      },
    });
  } catch (error) {
    console.error('Update provider error:', error);
    res.status(500).json({ error: 'Failed to update provider' });
  }
};

// ============================================================================
// Delete Provider
// ============================================================================

export const deleteProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;

    const existing = await prisma.deliveryProvider.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }

    await prisma.deliveryProvider.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete provider error:', error);
    res.status(500).json({ error: 'Failed to delete provider' });
  }
};

// ============================================================================
// Test Credentials
// ============================================================================

export const testProviderCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { provider, credentials } = req.body;

    if (!provider || !credentials) {
      res.status(400).json({ error: 'Provider and credentials are required' });
      return;
    }

    const result = await deliveryService.testCredentials(provider, credentials);
    res.json(result);
  } catch (error: any) {
    console.error('Test credentials error:', error.message);
    const msg = error.response?.data?.message || error.message || 'Failed to test credentials';
    res.status(400).json({ success: false, message: msg });
  }
};

// ============================================================================
// Send Order to Delivery
// ============================================================================

export const sendOrderToDelivery = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const orderId = req.params.orderId as string;
    const {
      providerId,
      toWilayaId,
      toCommuneId,
      isStopdesk,
      note,
    } = req.body;

    // 1. Find order
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (order.status === 'cancelled') {
      res.status(400).json({ error: 'Cannot send a cancelled order' });
      return;
    }

    if (order.deliveryStatus !== 'not_sent') {
      res.status(400).json({ error: 'Order has already been sent to delivery' });
      return;
    }

    // 2. Get delivery provider config
    let providerConfig;
    if (providerId) {
      providerConfig = await prisma.deliveryProvider.findFirst({
        where: { id: providerId, userId: req.user.userId, isActive: true },
      });
    } else {
      providerConfig = await prisma.deliveryProvider.findFirst({
        where: { userId: req.user.userId, isActive: true, isDefault: true },
      });
      if (!providerConfig) {
        providerConfig = await prisma.deliveryProvider.findFirst({
          where: { userId: req.user.userId, isActive: true },
        });
      }
    }

    if (!providerConfig) {
      res.status(400).json({ error: 'No delivery provider configured. Add one in Settings.' });
      return;
    }

    // 3. Decrypt credentials
    let credentials: Record<string, string>;
    try {
      credentials = JSON.parse(decrypt(providerConfig.credentials));
    } catch {
      res.status(500).json({ error: 'Failed to decrypt provider credentials' });
      return;
    }

    // 4. Build product description
    const orderWithItems = order as typeof order & { items: Array<{ productName: string; quantity: number }> };
    const productDesc = orderWithItems.items
      .map(i => `${i.productName} x${i.quantity}`)
      .join(', ');

    // 5. Resolve wilaya names for providers that need them
    const destWilayaId = toWilayaId || providerConfig.senderWilayaId || 16;
    const fromWilayaId = providerConfig.senderWilayaId || 16;
    const destWilaya = wilayas.find(w => w.id === destWilayaId);
    const fromWilaya = wilayas.find(w => w.id === fromWilayaId);

    const shipmentData: deliveryService.CreateShipmentData = {
      name: order.clientName,
      phone: order.clientPhone || '',
      address: order.clientAddress || '',
      to_wilaya_id: destWilayaId,
      to_wilaya_name: destWilaya?.nameFr || '',
      to_commune_name: toCommuneId || '',
      from_wilaya_id: fromWilayaId,
      from_wilaya_name: fromWilaya?.nameFr || '',
      price: Number(order.total),
      product: productDesc,
      is_stopdesk: isStopdesk || false,
      note: note || order.notes || '',
      external_id: order.orderNumber,
    };

    const result = await deliveryService.createShipment(
      providerConfig.provider,
      credentials,
      shipmentData
    );

    if (!result.success) {
      res.status(400).json({ error: result.error || 'Failed to create shipment' });
      return;
    }

    // 6. Update order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingNumber: result.tracking || null,
        deliveryProvider: providerConfig.provider,
        deliveryStatus: 'sent',
        deliveryFee: 0, // Will be updated when rates are fetched
        deliverySentAt: new Date(),
        status: order.status === 'confirmed' ? 'dispatched' : order.status,
      },
      include: {
        items: true,
        calls: { orderBy: { calledAt: 'desc' } },
      },
    });

    // 7. Create notification
    await createNotification({
      userId: req.user.userId,
      type: 'delivery_sent',
      title: 'Order Sent to Delivery',
      message: `Order ${order.orderNumber} sent via ${providerConfig.displayName}${result.tracking ? ` — Tracking: ${result.tracking}` : ''}`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        provider: providerConfig.provider,
        tracking: result.tracking,
      },
    });

    res.json({
      order: updatedOrder,
      shipment: result.data,
      tracking: result.tracking,
    });
  } catch (error: any) {
    console.error('Send to delivery error:', error.message);
    const msg = error.response?.data?.message || error.message || 'Failed to send to delivery';
    res.status(500).json({ error: msg });
  }
};

// ============================================================================
// Get Tracking Info
// ============================================================================

export const getTrackingInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const orderId = req.params.orderId as string;

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (!order.trackingNumber || !order.deliveryProvider) {
      res.status(400).json({ error: 'Order has no tracking information' });
      return;
    }

    // Get provider credentials
    const providerConfig = await prisma.deliveryProvider.findFirst({
      where: { userId: req.user.userId, provider: order.deliveryProvider },
    });

    if (!providerConfig) {
      res.status(400).json({ error: 'Delivery provider no longer configured' });
      return;
    }

    let credentials: Record<string, string>;
    try {
      credentials = JSON.parse(decrypt(providerConfig.credentials));
    } catch {
      res.status(500).json({ error: 'Failed to decrypt provider credentials' });
      return;
    }

    const result = await deliveryService.getShipmentStatus(
      order.deliveryProvider,
      credentials,
      order.trackingNumber
    );

    res.json(result);
  } catch (error: any) {
    console.error('Get tracking error:', error.message);
    const msg = error.response?.data?.message || error.message || 'Failed to get tracking';
    res.status(500).json({ error: msg });
  }
};

// ============================================================================
// Get Shipping Label
// ============================================================================

export const getShippingLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const orderId = req.params.orderId as string;

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (!order.trackingNumber || !order.deliveryProvider) {
      res.status(400).json({ error: 'Order has no tracking information' });
      return;
    }

    const providerConfig = await prisma.deliveryProvider.findFirst({
      where: { userId: req.user.userId, provider: order.deliveryProvider },
    });

    if (!providerConfig) {
      res.status(400).json({ error: 'Delivery provider no longer configured' });
      return;
    }

    let credentials: Record<string, string>;
    try {
      credentials = JSON.parse(decrypt(providerConfig.credentials));
    } catch {
      res.status(500).json({ error: 'Failed to decrypt provider credentials' });
      return;
    }

    const result = await deliveryService.getShipmentLabel(
      order.deliveryProvider,
      credentials,
      order.trackingNumber
    );

    res.json(result);
  } catch (error: any) {
    console.error('Get label error:', error.message);
    const msg = error.response?.data?.message || error.message || 'Failed to get label';
    res.status(500).json({ error: msg });
  }
};

// ============================================================================
// Get Delivery Rates
// ============================================================================

export const getDeliveryRates = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { provider, toWilaya, fromWilaya } = req.query;

    if (!provider || !toWilaya) {
      res.status(400).json({ error: 'Provider and toWilaya query params are required' });
      return;
    }

    const providerConfig = await prisma.deliveryProvider.findFirst({
      where: {
        userId: req.user.userId,
        provider: provider as string,
        isActive: true,
      },
    });

    if (!providerConfig) {
      res.status(404).json({ error: 'Provider not configured' });
      return;
    }

    let credentials: Record<string, string>;
    try {
      credentials = JSON.parse(decrypt(providerConfig.credentials));
    } catch {
      res.status(500).json({ error: 'Failed to decrypt provider credentials' });
      return;
    }

    const result = await deliveryService.getDeliveryRates(
      provider as string,
      credentials,
      Number(fromWilaya) || providerConfig.senderWilayaId || 16,
      Number(toWilaya)
    );

    res.json(result);
  } catch (error: any) {
    console.error('Get rates error:', error.message);
    const msg = error.response?.data?.message || error.message || 'Failed to get rates';
    res.status(500).json({ error: msg });
  }
};
