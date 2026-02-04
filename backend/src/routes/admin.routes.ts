import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAllProviders,
  updateProvider,
} from '../controllers/ai-providers.controller';

const router = Router();

// All admin routes require authentication
// TODO: Add admin role check middleware when super admin system is built
router.use(authenticate);

// ============================================================================
// AI Providers (admin management)
// ============================================================================
router.get('/ai-providers', getAllProviders);
router.put('/ai-providers/:provider', updateProvider);

export default router;
