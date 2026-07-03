import { Router } from 'express';
import { verifyMetaWebhook, handleMetaWebhook, handleDataDeletion, dataDeletionStatus } from '../controllers/webhook.controller';

const router = Router();

// Meta webhook verification (GET)
router.get('/meta', verifyMetaWebhook);

// Meta webhook events (POST)
router.post('/meta', handleMetaWebhook);

// Meta data-deletion callback (App Review requirement) + human status page
router.post('/meta/data-deletion', handleDataDeletion);
router.get('/meta/data-deletion/status', dataDeletionStatus);

export default router;
