import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  getAllProviders,
  updateProvider,
} from '../controllers/ai-providers.controller';
import {
  getAdminAnalytics,
  listUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  listSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  listConversations,
  getConversationDetails,
  listAdminProducts,
  listAllCategories,
  listAllPages,
  listAllAgents,
  updateAdminProfile,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(requireAdmin);

// ============================================================================
// Platform analytics
// ============================================================================
router.get('/analytics', getAdminAnalytics);

// ============================================================================
// Users management
// ============================================================================
router.get('/users', listUsers);
router.get('/users/:userId', getUserDetails);
router.patch('/users/:userId', updateUser);
router.delete('/users/:userId', deleteUser);

// ============================================================================
// Plans
// ============================================================================
router.get('/plans', listPlans);
router.post('/plans', createPlan);
router.patch('/plans/:planId', updatePlan);
router.delete('/plans/:planId', deletePlan);

// ============================================================================
// Subscriptions (per-user plan assignments with billing dates)
// ============================================================================
router.get('/subscriptions', listSubscriptions);
router.post('/subscriptions', createSubscription);
router.patch('/subscriptions/:subId', updateSubscription);
router.delete('/subscriptions/:subId', deleteSubscription);

// ============================================================================
// Conversations (cross-user)
// ============================================================================
router.get('/conversations', listConversations);
router.get('/conversations/:conversationId', getConversationDetails);

// ============================================================================
// Products (cross-user)
// ============================================================================
router.get('/products', listAdminProducts);

// ============================================================================
// Lookup data
// ============================================================================
router.get('/lookups/categories', listAllCategories);
router.get('/lookups/pages', listAllPages);
router.get('/lookups/agents', listAllAgents);

// ============================================================================
// Admin profile / settings
// ============================================================================
router.patch('/profile', updateAdminProfile);

// ============================================================================
// AI Providers (admin management)
// ============================================================================
router.get('/ai-providers', getAllProviders);
router.put('/ai-providers/:provider', updateProvider);

export default router;
