import { createHash, createHmac, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { signAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { REFRESH_TTL_MS } from '../utils/cookies.js';
import type { RegisterInput } from '../validation/v1.schema.js';

const BCRYPT_ROUNDS = 12;
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
// Refresh tokens at rest are HMAC-keyed with the refresh secret: a database
// snapshot alone cannot be used to mint or validate sessions.
const keyRefresh = (value: string): string =>
  createHmac('sha256', env.JWT_REFRESH_SECRET || 'dev-only-pepper').update(value).digest('hex');

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export function toPublicUser(row: {
  id: string;
  name: string;
  email: string;
  currency: string;
  timezone: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    currency: row.currency,
    timezone: row.timezone,
    createdAt: row.createdAt.toISOString(),
  };
}

async function issueSession(userId: string, email: string): Promise<SessionTokens> {
  const accessToken = signAccessToken({ sub: userId, email });
  const refreshToken = randomBytes(48).toString('hex');
  await prisma.refreshToken.create({
    data: { userId, tokenHash: keyRefresh(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  return { accessToken, refreshToken };
}

export async function registerUser(input: RegisterInput): Promise<{ user: ReturnType<typeof toPublicUser>; tokens: SessionTokens }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Try signing in instead.');
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        currency: input.currency,
        timezone: input.timezone ?? null,
      },
    });
    const tokens = await issueSession(user.id, user.email);
    return { user: toPublicUser(user), tokens };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Try signing in instead.');
    }
    throw error;
  }
}

export async function loginUser(input: { email: string; password: string }) {
  const row = await prisma.user.findUnique({ where: { email: input.email } });
  const invalid = new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  if (!row) throw invalid;
  const matches = await bcrypt.compare(input.password, row.passwordHash);
  if (!matches) throw invalid;
  const tokens = await issueSession(row.id, row.email);
  return { user: toPublicUser(row), tokens };
}

/**
 * Rotation: the presented token must exist, be unrevoked and unexpired. Its
 * row is revoked immediately and a fresh pair is issued. Presenting a token
 * that was already revoked is treated as theft — every session of that user
 * is revoked on the spot.
 */
export async function refreshSession(presentedToken: string): Promise<{ user: ReturnType<typeof toPublicUser>; tokens: SessionTokens }> {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: keyRefresh(presentedToken) }, include: { user: true } });
  if (!row) {
    throw new ApiError(401, 'REFRESH_INVALID', 'Your session could not be renewed. Sign in again.');
  }
  if (row.revokedAt || row.expiresAt.getTime() < Date.now()) {
    await prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw new ApiError(401, 'REFRESH_INVALID', 'Your session was revoked for safety. Sign in again.');
  }
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  const tokens = await issueSession(row.userId, row.user.email);
  return { user: toPublicUser(row.user), tokens };
}

export async function revokeSession(presentedToken: string | undefined): Promise<void> {
  if (!presentedToken) return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: keyRefresh(presentedToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function getUserById(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Refresh the session and try again.');
  }
  const row = await prisma.user.findUnique({ where: { id } });
  if (!row) throw new ApiError(401, 'UNAUTHENTICATED', 'Your account no longer exists. Please sign in again.');
  return toPublicUser(row);
}
