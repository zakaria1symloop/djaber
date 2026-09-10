import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getProfile } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Register — `.withMessage` carries an ERROR CODE; `validate` translates it.
router.post(
  '/register',
  [
    // Type guards run FIRST: `.trim()` is a sanitizer and would silently turn
    // `{"firstName": {...}}` into the string "[object Object]" before any check.
    body('firstName').custom((v) => v === undefined || typeof v === 'string').withMessage('FIELD_INVALID'),
    body('lastName').custom((v) => v === undefined || typeof v === 'string').withMessage('FIELD_INVALID'),
    body('email').isEmail().withMessage('FIELD_INVALID_EMAIL'),
    body('password').isLength({ min: 8 }).withMessage('AUTH_PASSWORD_TOO_SHORT'),
    body('firstName').trim().notEmpty().withMessage('AUTH_FIRST_NAME_REQUIRED'),
    body('lastName').trim().notEmpty().withMessage('AUTH_LAST_NAME_REQUIRED'),
    body('plan').optional().isIn(['individual', 'teams']).withMessage('AUTH_INVALID_PLAN'),
  ],
  validate,
  register
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('FIELD_INVALID_EMAIL'),
    body('password').notEmpty().withMessage('AUTH_PASSWORD_REQUIRED'),
  ],
  validate,
  login
);

// Get profile (protected route)
router.get('/profile', authenticate, getProfile);

export default router;
