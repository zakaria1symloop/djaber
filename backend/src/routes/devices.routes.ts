import { Router } from 'express';
import { registerDevice, unregisterDevice } from '../controllers/devices.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Register/refresh an Expo push token for the logged-in user
router.post('/register', authenticate, registerDevice);

// Remove a token (logout)
router.post('/unregister', authenticate, unregisterDevice);

export default router;
