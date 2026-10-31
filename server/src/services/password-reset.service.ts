import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { env, isProd } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const RESET_TTL_MS = 60 * 60 * 1000; // one hour
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export interface ForgotResult {
  sent: true;
  /** Dev convenience only: never returned in production. */
  resetUrl?: string;
}

/**
 * No SMTP is wired yet, so the reset link is written to the server log — the
 * flow (token hash, expiry, single use) is the real one. In production this
 * function must be extended to email the link instead of logging it.
 */
export async function requestReset(email: string): Promise<ForgotResult> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    // Same response either way: never reveal whether an account exists.
    return { sent: true };
  }
  const token = randomBytes(32).toString('hex');
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });
  const resetUrl = `${env.CLIENT_ORIGIN}/reset?token=${token}`;
  if (!isProd) {
    console.info(`[password-reset] link for ${email}: ${resetUrl}`);
    return { sent: true, resetUrl };
  }
  return { sent: true };
}

export async function performReset(token: string, newPassword: string): Promise<void> {
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, 'RESET_TOKEN_INVALID', 'This reset link is invalid or has expired. Request a new one.');
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
}
