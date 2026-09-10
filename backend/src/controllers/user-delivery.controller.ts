import { Request, Response } from 'express';
import prisma from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';
import { wilayas } from '../data/wilayas';
import * as deliveryService from '../services/delivery.service';
import { createNotification } from '../services/notification.service';
import { ApiError, fail, handleError, type ErrorCode } from '../errors';
import { Validator } from '../middleware/validate';

const PROVIDERS = ['yalidine', 'zrexpress', 'maystro'] as const;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Credentials must be a non-empty plain object of strings; returns it or records a field error. */
function credentialsObject(v: Validator, value: unknown, required: boolean): Record<string, string> | undefined {
  if (value === undefined || value === null) {
    if (required) v.add('credentials', 'FIELD_REQUIRED');
    return undefined;
  }
  if (typeof value !== 'object' || Array.isArray(value) || Object.keys(value as object).length === 0) {
    v.add('credentials', 'FIELD_INVALID');
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === undefined || val === null) continue;
    if (typeof val !== 'string' && typeof val !== 'number') {
      v.add('credentials', 'FIELD_INVALID');
      return undefined;
    }
    out[k] = String(val);
  }
  if (Object.keys(out).length === 0) {
    v.add('credentials', 'FIELD_INVALID');
    return undefined;
  }
  return out;
}

/** Optional wilaya id (1–58); `undefined` when absent, `null` when explicitly cleared. */
function wilayaId(v: Validator, value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return v.integer(value, field, { min: 1, max: 58 });
}

/** Decrypt stored courier credentials or throw a 500 DELIVERY_CREDENTIALS_UNREADABLE. */
function readCredentials(encrypted: string): Record<string, string> {
  try {
    return JSON.parse(decrypt(encrypted));
  } catch {
    throw new ApiError('DELIVERY_CREDENTIALS_UNREADABLE');
  }
}

/** Message an HTTP client (axios) error carries from the courier, if any. */
function courierMessage(error: unknown): string | null {
  const e = error as { isAxiosError?: boolean; response?: { data?: { message?: unknown; error?: unknown } }; code?: string; message?: string };
  if (!e || typeof e !== 'object') return null;
  if (!e.isAxiosError && !e.response) return null;
  const data = e.response?.data;
  const msg = typeof data?.message === 'string' ? data.message : typeof data?.error === 'string' ? data.error : null;
  return msg || (e.response ? `HTTP ${(e.response as { status?: number }).status ?? ''}`.trim() : 'connection failed');
}

/** Courier HTTP failures → 502 DELIVERY_PROVIDER_ERROR; everything else → handleError with `fallback`. */
function handleCourierError(req: Request, res: Response, error: unknown, fallback: ErrorCode): void {
  const msg = courierMessage(error);
  if (msg) {
    console.error(`[${req.method} ${req.originalUrl}] DELIVERY_PROVIDER_ERROR:`, msg);
    return fail(req, res, 'DELIVERY_PROVIDER_ERROR', { message: msg });
  }
  handleError(req, res, error, fallback);
}

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
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

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
    handleError(req, res, error, 'DELIVERY_PROVIDER_LIST_FAILED');
  }
};

// ============================================================================
// Add Provider Configuration
// ============================================================================

export const addProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const b = req.body ?? {};
    const v = new Validator();
    const provider = v.oneOf(b.provider, 'provider', PROVIDERS);
    const displayName = v.optionalString(b.displayName, 'displayName', { max: 100 });
    const credentials = credentialsObject(v, b.credentials, true);
    const isDefault = v.boolean(b.isDefault, 'isDefault', false);
    const senderName = v.optionalString(b.senderName, 'senderName', { max: 100 });
    const senderPhone = v.optionalString(b.senderPhone, 'senderPhone', { max: 30 });
    const senderAddress = v.optionalString(b.senderAddress, 'senderAddress', { max: 255 });
    const senderWilayaId = wilayaId(v, b.senderWilayaId, 'senderWilayaId') ?? null;
    v.throwIfAny();

    // Check for existing
    const existing = await prisma.deliveryProvider.findUnique({
      where: { userId_provider: { userId: req.user.userId, provider } },
    });
    if (existing) return fail(req, res, 'DELIVERY_PROVIDER_ALREADY_ADDED', { provider });

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
        isDefault,
        senderName,
        senderPhone,
        senderAddress,
        senderWilayaId,
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
    if ((error as { code?: string })?.code === 'P2002') return fail(req, res, 'DELIVERY_PROVIDER_ALREADY_ADDED', { provider: String(req.body?.provider ?? '') });
    handleError(req, res, error, 'DELIVERY_PROVIDER_ADD_FAILED');
  }
};

// ============================================================================
// Update Provider Configuration
// ============================================================================

export const updateProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const id = String(req.params.id);
    const b = req.body ?? {};

    const v = new Validator();
    const updateData: Record<string, unknown> = {};
    if (b.displayName !== undefined) updateData.displayName = v.requiredString(b.displayName, 'displayName', { max: 100 });
    if (b.isActive !== undefined) updateData.isActive = v.boolean(b.isActive, 'isActive');
    if (b.senderName !== undefined) updateData.senderName = v.optionalString(b.senderName, 'senderName', { max: 100 });
    if (b.senderPhone !== undefined) updateData.senderPhone = v.optionalString(b.senderPhone, 'senderPhone', { max: 30 });
    if (b.senderAddress !== undefined) updateData.senderAddress = v.optionalString(b.senderAddress, 'senderAddress', { max: 255 });
    const senderWilayaId = wilayaId(v, b.senderWilayaId, 'senderWilayaId');
    if (senderWilayaId !== undefined) updateData.senderWilayaId = senderWilayaId;
    const credentials = credentialsObject(v, b.credentials, false);
    const isDefault = b.isDefault === undefined || b.isDefault === null ? undefined : v.boolean(b.isDefault, 'isDefault');
    v.throwIfAny();

    const existing = await prisma.deliveryProvider.findFirst({
      where: { id, userId: req.user.userId },
    });
    if (!existing) return fail(req, res, 'DELIVERY_PROVIDER_NOT_FOUND');

    if (credentials) {
      updateData.credentials = encrypt(JSON.stringify(credentials));
    }

    if (isDefault === true) {
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
    handleError(req, res, error, 'DELIVERY_PROVIDER_UPDATE_FAILED');
  }
};

// ============================================================================
// Delete Provider
// ============================================================================

export const deleteProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const id = String(req.params.id);

    const existing = await prisma.deliveryProvider.findFirst({
      where: { id, userId: req.user.userId },
    });
    if (!existing) return fail(req, res, 'DELIVERY_PROVIDER_NOT_FOUND');

    await prisma.deliveryProvider.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    handleError(req, res, error, 'DELIVERY_PROVIDER_DELETE_FAILED');
  }
};

// ============================================================================
// Test Credentials
// ============================================================================

export const testProviderCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const b = req.body ?? {};
    const v = new Validator();
    const provider = v.oneOf(b.provider, 'provider', PROVIDERS);
    const credentials = credentialsObject(v, b.credentials, true);
    v.throwIfAny();

    // 200 { success, message } is the contract the settings page relies on (it renders `message`)
    const result = await deliveryService.testCredentials(provider, credentials!);
    res.json(result);
  } catch (error) {
    handleCourierError(req, res, error, 'DELIVERY_CREDENTIALS_TEST_FAILED');
  }
};

// ============================================================================
// Send Order to Delivery
// ============================================================================

export const sendOrderToDelivery = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const orderId = String(req.params.orderId);
    const b = req.body ?? {};

    const v = new Validator();
    const providerId = v.optionalString(b.providerId, 'providerId', { max: 64 });
    const toWilayaId = b.toWilayaId === undefined || b.toWilayaId === null || b.toWilayaId === ''
      ? null
      : v.integer(b.toWilayaId, 'toWilayaId', { min: 1, max: 58 });
    const toCommuneId = v.optionalString(b.toCommuneId, 'toCommuneId', { max: 100 });
    const isStopdesk = v.boolean(b.isStopdesk, 'isStopdesk', false);
    const note = v.optionalString(b.note, 'note', { max: 1000 });
    v.throwIfAny();

    // 1. Find order
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId },
      include: { items: { include: { product: true } } },
    });
    if (!order) return fail(req, res, 'ORDER_NOT_FOUND');
    if (order.status === 'cancelled') return fail(req, res, 'DELIVERY_ORDER_CANCELLED');
    if (order.deliveryStatus !== 'not_sent') return fail(req, res, 'DELIVERY_ORDER_ALREADY_SENT');

    // 2. Get delivery provider config
    let providerConfig;
    if (providerId) {
      providerConfig = await prisma.deliveryProvider.findFirst({
        where: { id: providerId, userId: req.user.userId, isActive: true },
      });
      if (!providerConfig) return fail(req, res, 'DELIVERY_PROVIDER_NOT_FOUND');
    } else {
      providerConfig = await prisma.deliveryProvider.findFirst({
        where: { userId: req.user.userId, isActive: true, isDefault: true },
      });
      if (!providerConfig) {
        providerConfig = await prisma.deliveryProvider.findFirst({
          where: { userId: req.user.userId, isActive: true },
        });
      }
      if (!providerConfig) return fail(req, res, 'DELIVERY_NO_ACTIVE_PROVIDER');
    }

    // 3. Decrypt credentials
    const credentials = readCredentials(providerConfig.credentials);

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
      is_stopdesk: isStopdesk,
      note: note || order.notes || '',
      external_id: order.orderNumber,
    };

    const result = await deliveryService.createShipment(
      providerConfig.provider,
      credentials,
      shipmentData
    );

    if (!result.success) {
      return fail(req, res, 'DELIVERY_PROVIDER_ERROR', { message: result.error || 'shipment refused' });
    }

    // 6. Update order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingNumber: result.tracking || null,
        deliveryProvider: providerConfig.provider,
        deliveryStatus: 'sent',
        // Keep the deliveryFee quoted at order creation — the customer was
        // already told this amount; do not reset it here.
        deliverySentAt: new Date(),
        // 'shipped' is part of the canonical status lifecycle (pending →
        // confirmed → preparing → shipped → delivered); the old 'dispatched'
        // value was invisible to the orders tabs and stats.
        status: order.status === 'confirmed' ? 'shipped' : order.status,
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
  } catch (error) {
    handleCourierError(req, res, error, 'DELIVERY_SEND_FAILED');
  }
};

// ============================================================================
// Tracking / label share the same lookup
// ============================================================================

async function loadTrackedOrder(req: Request, res: Response): Promise<{ order: { trackingNumber: string; deliveryProvider: string }; credentials: Record<string, string> } | null> {
  const orderId = String(req.params.orderId);

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: req.user!.userId },
  });
  if (!order) { fail(req, res, 'ORDER_NOT_FOUND'); return null; }
  if (!order.trackingNumber || !order.deliveryProvider) { fail(req, res, 'DELIVERY_ORDER_NOT_TRACKED'); return null; }

  const providerConfig = await prisma.deliveryProvider.findFirst({
    where: { userId: req.user!.userId, provider: order.deliveryProvider },
  });
  if (!providerConfig) { fail(req, res, 'DELIVERY_PROVIDER_NOT_CONFIGURED'); return null; }

  return {
    order: { trackingNumber: order.trackingNumber, deliveryProvider: order.deliveryProvider },
    credentials: readCredentials(providerConfig.credentials),
  };
}

// ============================================================================
// Get Tracking Info
// ============================================================================

export const getTrackingInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const ctx = await loadTrackedOrder(req, res);
    if (!ctx) return;

    const result = await deliveryService.getShipmentStatus(
      ctx.order.deliveryProvider,
      ctx.credentials,
      ctx.order.trackingNumber
    );

    if (!result.success) {
      return fail(req, res, 'DELIVERY_PROVIDER_ERROR', { message: String(result.data?.error || 'tracking unavailable') });
    }

    res.json(result);
  } catch (error) {
    handleCourierError(req, res, error, 'DELIVERY_TRACKING_FAILED');
  }
};

// ============================================================================
// Get Shipping Label
// ============================================================================

export const getShippingLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const ctx = await loadTrackedOrder(req, res);
    if (!ctx) return;

    const result = await deliveryService.getShipmentLabel(
      ctx.order.deliveryProvider,
      ctx.credentials,
      ctx.order.trackingNumber
    );

    if (!result.success) {
      return fail(req, res, 'DELIVERY_PROVIDER_ERROR', { message: String(result.data?.error || 'label unavailable') });
    }

    res.json(result);
  } catch (error) {
    handleCourierError(req, res, error, 'DELIVERY_LABEL_FAILED');
  }
};

// ============================================================================
// Get Delivery Rates
// ============================================================================

export const getDeliveryRates = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const v = new Validator();
    const provider = v.oneOf(req.query.provider, 'provider', PROVIDERS);
    const toWilaya = v.integer(req.query.toWilaya, 'toWilaya', { min: 1, max: 58 });
    const fromWilaya = req.query.fromWilaya === undefined || req.query.fromWilaya === ''
      ? null
      : v.integer(req.query.fromWilaya, 'fromWilaya', { min: 1, max: 58 });
    v.throwIfAny();

    const providerConfig = await prisma.deliveryProvider.findFirst({
      where: { userId: req.user.userId, provider, isActive: true },
    });
    if (!providerConfig) return fail(req, res, 'DELIVERY_PROVIDER_NOT_FOUND');

    const credentials = readCredentials(providerConfig.credentials);

    const result = await deliveryService.getDeliveryRates(
      provider,
      credentials,
      fromWilaya || providerConfig.senderWilayaId || 16,
      toWilaya
    );

    if (!result.success) return fail(req, res, 'DELIVERY_RATES_UNAVAILABLE');

    res.json(result);
  } catch (error) {
    handleCourierError(req, res, error, 'DELIVERY_RATES_FAILED');
  }
};
