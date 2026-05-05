import { Router } from 'express';
import {
  getPageInsightsController,
  getPageConversationsController,
  getPageMessagesController,
  getPageAISettingsController,
  updatePageAISettingsController,
  getConversationMessagesController,
  updateConversationController,
  sendReplyController,
  syncPageConversationsController,
  analyzePagePostsController,
  importExtractedProductsController,
} from '../controllers/page-config.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// ---- Static routes FIRST (before :pageId catches them) ----

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', authenticate, getConversationMessagesController);

// Update conversation status (close, resolve, archive)
router.patch('/conversations/:conversationId', authenticate, updateConversationController);

// Send reply to conversation
router.post('/conversations/:conversationId/reply', authenticate, sendReplyController);

// ---- Dynamic :pageId routes ----

// Get Facebook page insights
router.get('/:pageId/insights', authenticate, getPageInsightsController);

// Get conversations for a page
router.get('/:pageId/conversations', authenticate, getPageConversationsController);

// Get message history for a page
router.get('/:pageId/messages', authenticate, getPageMessagesController);

// Get AI settings for a page
router.get('/:pageId/ai-settings', authenticate, getPageAISettingsController);

// Update AI settings for a page
router.put('/:pageId/ai-settings', authenticate, updatePageAISettingsController);

// Pull fresh conversations + messages from Facebook into our DB
router.post('/:pageId/sync', authenticate, syncPageConversationsController);

// AI-driven page analysis: extract products from page posts
router.post('/:pageId/analyze', authenticate, analyzePagePostsController);

// Import confirmed extracted products into the user's main stock
router.post('/:pageId/import-products', authenticate, importExtractedProductsController);

export default router;
