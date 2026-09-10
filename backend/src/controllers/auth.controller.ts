import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { ApiError, fail, handleError } from '../errors';
import { Validator } from '../middleware/validate';

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
