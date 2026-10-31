import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { CreateCategoryInput, UpdateCategoryInput } from '../validation/v1.schema.js';

export function toCategoryJson(row: { id: string; userId: string | null; name: string; type: string; icon: string; color: string }) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    type: row.type,
    icon: row.icon,
    color: row.color,
    isSystem: row.userId === null,
  };
}

/** System categories (userId null) plus the user's own — the full usable set. */
export async function listCategories(userId: string) {
  const rows = await prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toCategoryJson);
}

export async function createCategory(userId: string, input: CreateCategoryInput) {
  const clash = await prisma.category.findFirst({
    where: { userId, name: { equals: input.name, mode: 'insensitive' }, type: input.type },
    select: { id: true },
  });
  if (clash) {
    throw new ApiError(409, 'CATEGORY_EXISTS', `You already have a ${input.type.toLowerCase()} category named "${input.name}".`);
  }
  const row = await prisma.category.create({ data: { userId, name: input.name, type: input.type, icon: input.icon, color: input.color } });
  return toCategoryJson(row);
}

export async function updateCategory(userId: string, id: string, input: UpdateCategoryInput): Promise<void> {
  const row = await prisma.category.findUnique({ where: { id } });
  if (!row || (row.userId !== null && row.userId !== userId)) {
    throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'That category does not exist.');
  }
  if (row.userId === null) {
    throw new ApiError(403, 'SYSTEM_CATEGORY', 'System categories cannot be edited.');
  }
  try {
    await prisma.category.update({ where: { id }, data: input });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'CATEGORY_EXISTS', 'You already have a category with that name and type.');
    }
    throw error;
  }
}

/** Deleting a category in use would orphan its transactions — refuse, plainly. */
export async function deleteCategory(userId: string, id: string): Promise<void> {
  const row = await prisma.category.findUnique({ where: { id } });
  if (!row || (row.userId !== null && row.userId !== userId)) {
    throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'That category does not exist.');
  }
  if (row.userId === null) {
    throw new ApiError(403, 'SYSTEM_CATEGORY', 'System categories cannot be deleted.');
  }
  const inUse = await prisma.transaction.count({ where: { categoryId: id, userId } });
  if (inUse > 0) {
    throw new ApiError(409, 'CATEGORY_IN_USE', `"${row.name}" is used by ${inUse} transaction(s) and cannot be deleted.`);
  }
  await prisma.budget.deleteMany({ where: { categoryId: id, userId } });
  await prisma.category.delete({ where: { id } });
}
