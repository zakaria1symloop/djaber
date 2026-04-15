import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth.routes';
import webhookRoutes from './routes/webhook.routes';
import pagesRoutes from './routes/pages.routes';
import pageConfigRoutes from './routes/page-config.routes';
import stockRoutes from './routes/stock.routes';
import userStockRoutes from './routes/user-stock.routes';
import adminRoutes from './routes/admin.routes';
import prisma from './config/database';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - CORS supports multiple origins from env (comma-separated)
// In addition to the explicit allowlist, any *.vercel.app subdomain is allowed
// so that Vercel preview deploys work without manual whitelisting.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

const isAllowedOrigin = (origin: string): boolean => {
  if (allowedOrigins.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host.endsWith('.vercel.app')) return true;
    if (host === 'localhost' || host === '127.0.0.1') return true;
  } catch {
    return false;
  }
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve legal documents
app.get('/privacy-policy.html', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/privacy-policy.html'));
});

app.get('/terms-of-service.html', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/terms-of-service.html'));
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Djaber.ai API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    message: 'Welcome to Djaber.ai API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      pages: '/api/pages',
      conversations: '/api/conversations',
      webhooks: '/api/webhooks',
      stock: '/api/stock',
    },
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/pages', pagesRoutes);
app.use('/api/pages', pageConfigRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/user-stock', userStockRoutes);
app.use('/api/admin', adminRoutes);

// ============================================================================
// Chargily Pay endpoints
// ============================================================================
import { createPlanCheckout, activateSubscriptionFromPayment, verifyCheckout, isConfigured as chargilyConfigured } from './services/chargily.service';
import { authenticate } from './middleware/auth';

// Create checkout session for a plan (authenticated user)
app.post('/api/payments/checkout', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!chargilyConfigured()) { res.status(503).json({ error: 'Payment gateway not configured' }); return; }

    const { planSlug, billingCycle = 'monthly' } = req.body;
    if (!planSlug) { res.status(400).json({ error: 'planSlug is required' }); return; }

    const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan || !plan.isActive) { res.status(404).json({ error: 'Plan not found or inactive' }); return; }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const amount = billingCycle === 'yearly' ? Number(plan.priceYearly) : Number(plan.priceMonthly);
    if (amount <= 0) { res.status(400).json({ error: 'This plan is free — no payment needed' }); return; }

    const result = await createPlanCheckout({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
      planSlug: plan.slug,
      planName: plan.name,
      amount,
      billingCycle,
    });

    if (!result.success) {
      res.status(502).json({ error: result.error || 'Failed to create checkout' });
      return;
    }

    res.json({ checkoutUrl: result.checkoutUrl, checkoutId: result.checkoutId });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// Chargily webhook (no auth — Chargily calls this)
app.post('/api/payments/chargily-webhook', async (req: Request, res: Response) => {
  try {
    const checkoutId = req.body?.data?.id;
    const status = req.body?.data?.status;
    const metadata = req.body?.data?.metadata || {};

    console.log('Chargily webhook:', { checkoutId, status, metadata });

    if (status === 'paid' && metadata.user_id && metadata.plan_slug) {
      await activateSubscriptionFromPayment({
        userId: metadata.user_id,
        planSlug: metadata.plan_slug,
        billingCycle: metadata.billing_cycle || 'monthly',
        checkoutId: checkoutId || '',
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Chargily webhook error:', error);
    res.json({ success: true }); // Always 200 so Chargily doesn't retry
  }
});

// Verify payment status (authenticated user)
app.get('/api/payments/verify/:checkoutId', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await verifyCheckout(String(req.params.checkoutId));
    if (result.success && result.data?.status === 'paid') {
      const metadata = result.data.metadata || {};
      if (metadata.user_id && metadata.plan_slug) {
        await activateSubscriptionFromPayment({
          userId: metadata.user_id,
          planSlug: metadata.plan_slug,
          billingCycle: metadata.billing_cycle || 'monthly',
          checkoutId: result.data.id || '',
        });
      }
    }
    res.json({ status: result.data?.status || 'unknown', data: result.data });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Public plans endpoint (no auth — for pricing page)
app.get('/api/plans', async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, slug: true, name: true, description: true,
        priceMonthly: true, priceYearly: true, currency: true,
        maxPages: true, maxAgents: true, maxProducts: true,
        maxConversations: true, maxTeamMembers: true,
        features: true, isFeatured: true,
      },
    });
    const parsed = plans.map((p) => ({
      ...p,
      features: (() => { try { return JSON.parse(p.features); } catch { return []; } })(),
    }));
    res.json({ plans: parsed });
  } catch {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Public CMS endpoint (no auth)
app.get('/api/cms/:slug', async (req: Request, res: Response) => {
  try {
    const page = await prisma.cmsPage.findFirst({
      where: { slug: String(req.params.slug), isPublished: true },
    });
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    res.json({ page });
  } catch {
    res.status(500).json({ error: 'Failed to fetch page' });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Seed default units if they don't exist
async function seedDefaultUnits() {
  const defaultUnits = [
    { name: 'Piece', abbreviation: 'pc' },
    { name: 'Kilogram', abbreviation: 'kg' },
    { name: 'Gram', abbreviation: 'g' },
    { name: 'Liter', abbreviation: 'L' },
    { name: 'Milliliter', abbreviation: 'ml' },
    { name: 'Box', abbreviation: 'box' },
    { name: 'Pack', abbreviation: 'pk' },
  ];

  for (const unit of defaultUnits) {
    const existing = await prisma.unit.findFirst({
      where: { userId: null, name: unit.name },
    });
    if (!existing) {
      await prisma.unit.create({
        data: {
          userId: null,
          name: unit.name,
          abbreviation: unit.abbreviation,
          isDefault: true,
        },
      });
    }
  }
}

// Start server on all interfaces (0.0.0.0) so it's accessible on the network
app.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);

  // Seed default units
  try {
    await seedDefaultUnits();
    console.log('Default units seeded');
  } catch (err) {
    console.error('Failed to seed default units:', err);
  }
});

export default app;
