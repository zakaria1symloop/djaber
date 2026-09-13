import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import authRoutes from './routes/auth.routes';
import webhookRoutes from './routes/webhook.routes';
import pagesRoutes from './routes/pages.routes';
import pageConfigRoutes from './routes/page-config.routes';
import stockRoutes from './routes/stock.routes';
import userStockRoutes from './routes/user-stock.routes';
import adminRoutes from './routes/admin.routes';
import devicesRoutes from './routes/devices.routes';
import prisma from './config/database';
import { fail, handleError } from './errors';

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

// Explicit robots.txt — Meta's crawler checks it before downloading product-card
// images from /uploads; without it Messenger rejects image sends (error 2018388).
app.get('/robots.txt', (_req: Request, res: Response) => {
  res.type('text/plain').send('User-agent: *\nAllow: /\n');
});

// Serve legal documents (Meta app review requires public policy URLs).
// The HTML files live at the REPO root, two levels up from backend/dist
// (or backend/src in dev) — backend/public never existed.
const repoRoot = path.join(__dirname, '../..');
app.get('/privacy-policy.html', (_req: Request, res: Response) => {
  res.sendFile(path.join(repoRoot, 'privacy-policy.html'));
});

app.get('/terms-of-service.html', (_req: Request, res: Response) => {
  res.sendFile(path.join(repoRoot, 'terms-of-service.html'));
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
app.use('/api/devices', devicesRoutes);

// ============================================================================
// API documentation (OpenAPI 3 + Swagger UI)
//   GET /api/docs               → interactive Swagger UI (Try it out works: same origin)
//   GET /api/docs/openapi.json  → machine-readable spec (import into Postman / codegen)
//   GET /api/docs/openapi.yaml  → same spec as YAML
// The spec lives in backend/openapi/openapi.yaml (one level up from dist/ or src/).
// ============================================================================
const openapiPath = path.join(__dirname, '../openapi/openapi.yaml');
if (fs.existsSync(openapiPath)) {
  const openapiSpec = YAML.parse(fs.readFileSync(openapiPath, 'utf8'));
  app.get('/api/docs/openapi.json', (_req: Request, res: Response) => {
    res.json(openapiSpec);
  });
  app.get('/api/docs/openapi.yaml', (_req: Request, res: Response) => {
    res.type('text/yaml').sendFile(openapiPath);
  });
  // The UI FETCHES the spec from /api/docs/openapi.json instead of receiving it
  // inline. Do not pass the spec object to setup(): swagger-ui-express injects
  // it with `template.replace('<% swaggerOptions %>', json)`, a STRING replace,
  // so any `$` pattern in a description (e.g. "`…\]$`" → `$\`` means "insert
  // the text before the match") splices template code into the JSON, the init
  // script stops parsing, and the page renders blank. Loading by URL keeps the
  // spec out of that replace entirely (and the init script tiny).
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(null, {
      customSiteTitle: 'Djaber.ai API docs',
      swaggerOptions: {
        url: '/api/docs/openapi.json',
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        tagsSorter: 'alpha',
      },
    })
  );
} else {
  console.warn(`OpenAPI spec not found at ${openapiPath} — /api/docs disabled`);
}

// ============================================================================
// Chargily Pay endpoints
// ============================================================================
import { createPlanCheckout, activateSubscriptionFromPayment, verifyCheckout, isConfigured as chargilyConfigured } from './services/chargily.service';
import { authenticate } from './middleware/auth';

// Create checkout session for a plan (authenticated user)
app.post('/api/payments/checkout', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    if (!chargilyConfigured()) return fail(req, res, 'PAYMENT_GATEWAY_NOT_CONFIGURED');

    const { planSlug, billingCycle = 'monthly' } = req.body ?? {};
    if (!planSlug || typeof planSlug !== 'string') return fail(req, res, 'FIELD_REQUIRED', { field: 'planSlug' });
    if (billingCycle !== 'monthly' && billingCycle !== 'yearly') return fail(req, res, 'FIELD_INVALID_ENUM', { field: 'billingCycle', allowed: 'monthly, yearly' });

    const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan || !plan.isActive) return fail(req, res, 'PLAN_NOT_FOUND');

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return fail(req, res, 'USER_NOT_FOUND');

    const amount = billingCycle === 'yearly' ? Number(plan.priceYearly) : Number(plan.priceMonthly);
    if (amount <= 0) return fail(req, res, 'PLAN_IS_FREE');

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
      console.error('Chargily checkout failed:', result.error);
      return fail(req, res, 'PAYMENT_CHECKOUT_FAILED');
    }

    res.json({ checkoutUrl: result.checkoutUrl, checkoutId: result.checkoutId });
  } catch (error) {
    handleError(req, res, error, 'PAYMENT_CHECKOUT_FAILED');
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
    console.log('Verifying payment:', req.params.checkoutId);
    const result = await verifyCheckout(String(req.params.checkoutId));
    console.log('Chargily verify result:', result.success, result.data?.status);
    if (result.success && result.data?.status === 'paid') {
      const metadata = result.data.metadata || {};
      console.log('Payment paid! Activating subscription:', metadata);
      if (metadata.user_id && metadata.plan_slug) {
        await activateSubscriptionFromPayment({
          userId: metadata.user_id,
          planSlug: metadata.plan_slug,
          billingCycle: metadata.billing_cycle || 'monthly',
          checkoutId: result.data.id || '',
        });
        console.log('Subscription activated for user:', metadata.user_id);
      }
    }
    res.json({ status: result.data?.status || 'unknown', data: result.data });
  } catch (error) {
    handleError(req, res, error, 'PAYMENT_VERIFY_FAILED');
  }
});

// Public plans endpoint (no auth — for pricing page)
app.get('/api/plans', async (req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, slug: true, name: true, description: true,
        priceMonthly: true, priceYearly: true, currency: true,
        maxPages: true, maxAgents: true, maxProducts: true,
        maxConversations: true, maxTeamMembers: true,
        monthlyCredits: true,
        features: true, isFeatured: true,
      },
    });
    const parsed = plans.map((p) => ({
      ...p,
      features: (() => { try { return JSON.parse(p.features); } catch { return []; } })(),
    }));
    res.json({ plans: parsed });
  } catch (error) {
    handleError(req, res, error);
  }
});

// Credit status endpoint (authenticated)
import { getCreditStatus } from './services/credits.service';
app.get('/api/credits', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const status = await getCreditStatus(req.user.userId);
    res.json(status);
  } catch (error) {
    handleError(req, res, error);
  }
});

// Public CMS endpoint (no auth)
app.get('/api/cms/:slug', async (req: Request, res: Response) => {
  try {
    const page = await prisma.cmsPage.findFirst({
      where: { slug: String(req.params.slug), isPublished: true },
    });
    if (!page) return fail(req, res, 'CMS_PAGE_NOT_FOUND');
    res.json({ page });
  } catch (error) {
    handleError(req, res, error);
  }
});

// 404 handler — translated like every other error (see src/errors)
app.use((req: Request, res: Response) => {
  fail(req, res, 'ROUTE_NOT_FOUND', { method: req.method, path: req.path });
});

// Global error handler: ApiError → its status/code; JSON parse / payload / multer /
// Prisma errors → 400/413/404/409; anything else → 500 INTERNAL_ERROR (logged).
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  handleError(req, res, err);
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
  console.log(`Public URL: ${process.env.BACKEND_URL || '(not set)'}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  // Seed default units
  try {
    await seedDefaultUnits();
    console.log('Default units seeded');
  } catch (err) {
    console.error('Failed to seed default units:', err);
  }
});

export default app;
