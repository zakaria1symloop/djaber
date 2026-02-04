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
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
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
