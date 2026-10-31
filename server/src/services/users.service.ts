import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { toPublicUser } from './auth.service.js';
import type { ProfileUpdateInput } from '../validation/v1.schema.js';

export async function getProfile(userId: string) {
  const row = await prisma.user.findUnique({ where: { id: userId } });
  if (!row) throw new ApiError(401, 'UNAUTHENTICATED', 'Your account no longer exists. Please sign in again.');
  return toPublicUser(row);
}

export async function updateProfile(userId: string, patch: ProfileUpdateInput) {
  const row = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone || null } : {}),
    },
  });
  return toPublicUser(row);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const row = await prisma.user.findUnique({ where: { id: userId } });
  if (!row) throw new ApiError(401, 'UNAUTHENTICATED', 'Your account no longer exists. Please sign in again.');
  const matches = await bcrypt.compare(currentPassword, row.passwordHash);
  if (!matches) throw new ApiError(400, 'WRONG_PASSWORD', 'Your current password is incorrect.');
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
