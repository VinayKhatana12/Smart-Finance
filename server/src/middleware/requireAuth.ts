import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { ACCESS_COOKIE } from '../utils/cookies.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { safeTimeZone } from '../utils/time.js';

export interface AuthUser {
  id: string;
  email: string;
  currency: string;
  /** The viewer's timezone for month-scoped queries (budgets, dashboard, reports). */
  tz: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  (async () => {
    const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (!token) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    }
    const payload = verifyAccessToken(token);
    // The timezone rides with every request so month boundaries follow the
    // user's clock immediately after they change it in Settings.
    const row = await prisma.user.findUnique({ where: { id: payload.sub }, select: { timezone: true, currency: true } });
    if (!row) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Your account no longer exists. Please sign in again.');
    }
    req.user = { id: payload.sub, email: payload.email, currency: row.currency, tz: safeTimeZone(row.timezone) };
  })()
    .then(() => next())
    .catch(next);
};
