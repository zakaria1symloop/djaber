import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { ApiError, fail, handleError, resolveLang } from '../errors';
import { Validator } from '../middleware/validate';
import { isMailConfigured, sendMail } from '../services/mail.service';
import { buildPasswordResetEmail } from '../services/email/password-reset';

const RESET_TTL_MINUTES = 60;
/** A new link is not e-mailed again if one was issued this recently (inbox spam guard). */
const RESET_RESEND_COOLDOWN_MS = 60 * 1000;

const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

/** Page that opens from the e-mail: APP_URL, else the first FRONTEND_URL. */
function resetPageUrl(rawToken: string): string {
  const base = (process.env.APP_URL || (process.env.FRONTEND_URL || '').split(',')[0] || 'https://djaber.vercel.app')
    .trim()
    .replace(/\/+$/, '');
  return `${base}/reset-password?token=${rawToken}`;
}

const PLANS = ['individual', 'teams'] as const;

/**
 * Reject non-string values for text fields BEFORE they are coerced.
 * Without this, `{"password": {...}}` becomes the literal string
 * "[object Object]" and creates an account nobody can sign in to.
 */
function stringOnly(v: Validator, value: unknown, field: string): unknown {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    v.add(field, 'FIELD_INVALID');
    return '';
  }
  return value;
}

function signToken(user: { id: string; email: string }): string {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not defined');
    throw new ApiError('AUTH_NOT_CONFIGURED');
  }
  return jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Route-level express-validator chains already answered 400 for the basics;
    // this pass normalises values and bounds lengths before they reach Prisma.
    const v = new Validator();
    const email = v.email(stringOnly(v, req.body.email, 'email'), 'email') as string;
    const password = v.requiredString(stringOnly(v, req.body.password, 'password'), 'password', { min: 8, max: 128 });
    const firstName = v.requiredString(stringOnly(v, req.body.firstName, 'firstName'), 'firstName', { max: 80 });
    const lastName = v.requiredString(stringOnly(v, req.body.lastName, 'lastName'), 'lastName', { max: 80 });
    const plan = v.oneOf(req.body.plan, 'plan', PLANS, 'individual');
    v.throwIfAny();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return fail(req, res, 'AUTH_EMAIL_TAKEN');

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        plan,
      },
    });

    const token = signToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        plan: user.plan,
      },
    });
  } catch (error) {
    handleError(req, res, error, 'AUTH_REGISTER_FAILED');
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const email = v.email(stringOnly(v, req.body.email, 'email'), 'email') as string;
    const password = v.requiredString(stringOnly(v, req.body.password, 'password'), 'password', { max: 128 });
    v.throwIfAny();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(req, res, 'AUTH_INVALID_CREDENTIALS');

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return fail(req, res, 'AUTH_INVALID_CREDENTIALS');

    const token = signToken(user);

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        plan: user.plan,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    handleError(req, res, error, 'AUTH_LOGIN_FAILED');
  }
};

/**
 * POST /api/auth/forgot-password { email }
 * Always answers 200 with the same body, whether or not the account exists, and
 * sends the e-mail AFTER responding, so neither the body nor the response time
 * reveals which e-mails are registered.
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const email = v.email(stringOnly(v, req.body?.email, 'email'), 'email') as string;
    v.throwIfAny();

    if (!isMailConfigured()) {
      console.error('forgot-password: SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS)');
      return fail(req, res, 'MAIL_NOT_CONFIGURED');
    }

    const lang = resolveLang(req);
    res.status(200).json({ message: 'If an account exists for this e-mail, a reset link has been sent.' });

    // --- after the response -------------------------------------------------
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, firstName: true } });
    if (!user) return;

    const recent = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null, createdAt: { gt: new Date(Date.now() - RESET_RESEND_COOLDOWN_MS) } },
      select: { id: true },
    });
    if (recent) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    await prisma.$transaction([
      // Only the newest link works.
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
        },
      }),
    ]);

    const mail = buildPasswordResetEmail(lang, {
      firstName: user.firstName,
      link: resetPageUrl(rawToken),
      minutes: RESET_TTL_MINUTES,
    });
    await sendMail({ to: user.email, ...mail });
  } catch (error) {
    if (res.headersSent) {
      console.error('forgot-password: e-mail not sent:', error);
      return;
    }
    handleError(req, res, error, 'AUTH_FORGOT_FAILED');
  }
};

async function findUsableResetToken(rawToken: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!record || record.usedAt) throw new ApiError('AUTH_RESET_TOKEN_INVALID');
  if (record.expiresAt.getTime() < Date.now()) throw new ApiError('AUTH_RESET_TOKEN_EXPIRED');
  return record;
}

/** GET /api/auth/reset-password/:token — lets the page say "link expired" before the user types. */
export const verifyResetToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = String(req.params.token || '');
    if (!/^[a-f0-9]{64}$/.test(raw)) return fail(req, res, 'AUTH_RESET_TOKEN_INVALID');
    await findUsableResetToken(raw);
    res.status(200).json({ valid: true });
  } catch (error) {
    handleError(req, res, error, 'AUTH_RESET_FAILED');
  }
};

/**
 * POST /api/auth/reset-password { token, password }
 * Sets the new password, burns the link (and every other open link of that
 * user), and signs the user in: the answer has the same shape as login.
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const raw = v.requiredString(stringOnly(v, req.body?.token, 'token'), 'token', { max: 128 });
    const password = v.requiredString(stringOnly(v, req.body?.password, 'password'), 'password', { min: 8, max: 128 });
    v.throwIfAny();
    if (!/^[a-f0-9]{64}$/.test(raw)) return fail(req, res, 'AUTH_RESET_TOKEN_INVALID');

    const record = await findUsableResetToken(raw);
    const hashedPassword = await bcrypt.hash(password, 10);

    // `usedAt: null` in the update makes a double submit of the same link fail
    // instead of resetting twice.
    const [burned, user] = await prisma.$transaction([
      prisma.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: record.userId }, data: { password: hashedPassword } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } }),
    ]);
    if (burned.count !== 1) throw new ApiError('AUTH_RESET_TOKEN_INVALID');

    res.status(200).json({
      message: 'Password updated',
      token: signToken(user),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        plan: user.plan,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    handleError(req, res, error, 'AUTH_RESET_FAILED');
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        plan: true,
        isAdmin: true,
        creditsUsed: true,
        creditsLimit: true,
        createdAt: true,
      },
    });

    if (!user) return fail(req, res, 'USER_NOT_FOUND');

    res.status(200).json({ user });
  } catch (error) {
    handleError(req, res, error, 'AUTH_PROFILE_FAILED');
  }
};
