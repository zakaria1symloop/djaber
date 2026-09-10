import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { fail, handleError } from '../errors';

interface JwtPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Bearer JWT guard. Answers 401 UNAUTHORIZED (no token) or 401 INVALID_TOKEN
 * (bad / expired token) — both translated per Accept-Language.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return fail(req, res, 'UNAUTHORIZED');
    }

    const token = authHeader.substring(7);

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return fail(req, res, 'INVALID_TOKEN');
    }
    handleError(req, res, error);
  }
};

/**
 * Requires the authenticated user to have isAdmin = true.
 * Must be used AFTER `authenticate`.
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) return fail(req, res, 'ADMIN_REQUIRED');
    next();
  } catch (error) {
    handleError(req, res, error);
  }
};
