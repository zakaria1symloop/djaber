import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  getAllProviders,
  updateProvider,
} from '../controllers/ai-providers.controller';
import { getAdminAnalytics } from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(requireAdmin);

// ============================================================================
// Platform analytics
// ============================================================================
router.get('/analytics', getAdminAnalytics);

// ============================================================================
// AI Providers (admin management)
// ============================================================================
router.get('/ai-providers', getAllProviders);
router.put('/ai-providers/:provider', updateProvider);

export default router;
