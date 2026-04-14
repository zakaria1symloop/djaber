import { Router } from 'express';
import {
  getPageInsightsController,
  getPageConversationsController,
  getPageMessagesController,
  getPageAISettingsController,
  updatePageAISettingsController,
  getConversationMessagesController,
  sendReplyController,
} from '../controllers/page-config.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// ---- Static routes FIRST (before :pageId catches them) ----

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', authenticate, getConversationMessagesController);

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

export default router;
