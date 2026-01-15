import { Router } from 'express';
import { verifyMetaWebhook, handleMetaWebhook } from '../controllers/webhook.controller';

const router = Router();

// Meta webhook verification (GET)
router.get('/meta', verifyMetaWebhook);

// Meta webhook events (POST)
router.post('/meta', handleMetaWebhook);

export default router;
