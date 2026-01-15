import { Router } from 'express';
import {
  getPageInsightsController,
  getPageConversationsController,
  getPageMessagesController,
  getPageAISettingsController,
  updatePageAISettingsController,
  sendReplyController,
} from '../controllers/page-config.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

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

// Send reply to conversation
router.post('/conversations/:conversationId/reply', authenticate, sendReplyController);

export default router;
