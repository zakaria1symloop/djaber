import { Router } from 'express';
import {
  connectFacebookPage,
  facebookCallback,
  connectInstagramPage,
  instagramCallback,
  getUserPages,
  disconnectPage,
} from '../controllers/pages.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get user's connected pages
router.get('/', authenticate, getUserPages);

// Initiate Facebook OAuth
router.get('/connect/facebook', authenticate, connectFacebookPage);

// Facebook OAuth callback
router.get('/callback/facebook', facebookCallback);

// Initiate Instagram OAuth
router.get('/connect/instagram', authenticate, connectInstagramPage);

// Instagram OAuth callback
router.get('/callback/instagram', instagramCallback);

// Disconnect a page
router.delete('/:pageId', authenticate, disconnectPage);

export default router;
