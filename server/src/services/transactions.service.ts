import { Prisma, type Prisma as PrismaTypes } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { twoDecimals } from '../utils/serialize.js';
import type { CreateTransactionInput, TransactionQuery, UpdateTransactionInput } from '../validation/v1.schema.js';

type TransactionRow = PrismaTypes.TransactionGetPayload<{ include: { category: true; account: true; transferAccount: true } }>;

function toJson(row: TransactionRow) {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account.name,
    transferAccountId: row.transferAccountId,
    transferAccountName: row.transferAccount?.name ?? null,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    categoryColor: row.category.color,
    type: row.type,
    amountPaise: row.amountPaise.toString(),
    amountDisplay: twoDecimals(row.amountPaise),
    description: row.description,
    notes: row.notes,
    transactionDate: row.transactionDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function buildWhere(userId: string, q: TransactionQuery): PrismaTypes.TransactionWhereInput {
  const where: PrismaTypes.TransactionWhereInput = { userId };
  if (q.q) {
    where.OR = [
      { description: { contains: q.q, mode: 'insensitive' } },
      { notes: { contains: q.q, mode: 'insensitive' } },
      { category: { name: { contains: q.q, mode: 'insensitive' } } },
    ];
  }
  if (q.type) where.type = q.type;
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.accountId) where.OR = [{ accountId: q.accountId }, { transferAccountId: q.accountId }];
  if (q.from || q.to) {
    where.transactionDate = {};
    if (q.from) where.transactionDate.gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) where.transactionDate.lte = new Date(`${q.to}T23:59:59.999Z`);
  }
  return where;
}

const SORTS: Record<string, PrismaTypes.TransactionOrderByWithRelationInput[]> = {
  date_desc: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
  date_asc: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
  amount_desc: [{ amountPaise: 'desc' }],
  amount_asc: [{ amountPaise: 'asc' }],
};

export async function listTransactions(userId: string, q: TransactionQuery) {
  const where = buildWhere(userId, q);
  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { category: true, account: true, transferAccount: true },
      orderBy: SORTS[q.sort] ?? SORTS.date_desc!,
      take: q.pageSize,
      skip: (q.page - 1) * q.pageSize,
    }),
  ]);
  return { items: rows.map(toJson), total, page: q.page, pageSize: q.pageSize };
}

export async function listAllForExport(userId: string, q: TransactionQuery) {
  const where = buildWhere(userId, q);
  const rows = await prisma.transaction.findMany({
    where,
    include: { category: true, account: true, transferAccount: true },
    orderBy: SORTS.date_desc!,
    take: 5000,
  });
  return rows.map(toJson);
}

export function toCsv(rows: ReturnType<typeof listAllForExport> extends Promise<infer R> ? R : never): string {
  const escape = (value: string): string => `"${value.replace(/"/g, '""')}"`;
  const header = ['Date', 'Type', 'Amount', 'Category', 'Account', 'Description', 'Notes'];
  const lines = rows.map((r) =>
    [
      r.transactionDate.slice(0, 10),
      r.type,
      r.amountDisplay,
      r.categoryName,
      r.type === 'TRANSFER' && r.transferAccountName ? `${r.accountName} → ${r.transferAccountName}` : r.accountName,
      r.description,
      r.notes,
    ]
      .map((cell) => escape(String(cell)))
      .join(','),
  );
  return [header.map(escape).join(','), ...lines].join('\r\n');
}

export async function getTransaction(userId: string, id: string) {
  const row = await prisma.transaction.findFirst({
    where: { id, userId },
    include: { category: true, account: true, transferAccount: true },
  });
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'That transaction does not exist.');
  return toJson(row);
}

export async function createTransaction(userId: string, input: CreateTransactionInput) {
  // Offline-replay dedupe: the same clientRequestId always returns the same
  // transaction, whether the first attempt came from the queue or online.
  if ('clientRequestId' in input && input.clientRequestId) {
    const existing = await prisma.transaction.findFirst({
      where: { userId, clientRequestId: input.clientRequestId },
      include: { category: true, account: true, transferAccount: true },
    });
    if (existing) return { json: toJson(existing), duplicate: true as const };
  }

  await assertAccount(userId, input.accountId);
  if (input.type === 'TRANSFER') {
    await assertAccount(userId, input.transferAccountId);
  } else {
    await assertCategory(userId, input.categoryId);
  }

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId,
        accountId: input.accountId,
        transferAccountId: input.type === 'TRANSFER' ? input.transferAccountId : null,
        categoryId: input.type === 'TRANSFER' ? await transferCategoryId(tx, userId) : input.categoryId,
        type: input.type,
        amountPaise: BigInt(input.amountPaise),
        description: input.description,
        notes: input.notes,
        transactionDate: input.transactionDate,
        ...(input.clientRequestId ? { clientRequestId: input.clientRequestId } : {}),
      },
      include: { category: true, account: true, transferAccount: true },
    });
    return created;
  });
  return { json: toJson(row), duplicate: false as const };
}

export async function updateTransaction(userId: string, id: string, input: UpdateTransactionInput) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId }, select: { id: true, type: true } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'That transaction does not exist.');
  if (input.accountId) await assertAccount(userId, input.accountId);
  if (input.transferAccountId) await assertAccount(userId, input.transferAccountId);
  if (input.categoryId) await assertCategory(userId, input.categoryId);
  if ((input.type === 'TRANSFER' || (!input.type && existing.type === 'TRANSFER')) && input.transferAccountId === undefined && !input.accountId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'A transfer needs both accounts.');
  }

  const result = await prisma.transaction.updateMany({
    where: { id, userId },
    data: {
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
      ...(input.transferAccountId !== undefined ? { transferAccountId: input.transferAccountId } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.amountPaise !== undefined ? { amountPaise: BigInt(input.amountPaise) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.transactionDate !== undefined ? { transactionDate: input.transactionDate } : {}),
    },
  });
  if (result.count === 0) throw new ApiError(404, 'NOT_FOUND', 'That transaction does not exist.');
  const row = await prisma.transaction.findFirst({
    where: { id, userId },
    include: { category: true, account: true, transferAccount: true },
  });
  return toJson(row!);
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  const row = await prisma.transaction.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'That transaction does not exist.');
  await prisma.transaction.delete({ where: { id } });
}

async function assertAccount(userId: string, accountId: string): Promise<void> {
  const row = await prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true } });
  if (!row) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Pick one of your own accounts.');
}

async function assertCategory(userId: string, categoryId: string): Promise<void> {
  const row = await prisma.category.findFirst({
    where: { id: categoryId, OR: [{ userId: null }, { userId }] },
    select: { id: true },
  });
  if (!row) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Pick a valid category.');
}

/** Transfers need a category row too; the system ledger keeps one reserved category. */
async function transferCategoryId(tx: PrismaTypes.TransactionClient, userId: string): Promise<string> {
  const category = await tx.category.upsert({
    where: { userId_name_type: { userId, name: 'Transfer', type: 'EXPENSE' } },
    update: {},
    create: { userId, name: 'Transfer', type: 'EXPENSE', icon: 'swap', color: '#5c6064' },
  });
  return category.id;
}
