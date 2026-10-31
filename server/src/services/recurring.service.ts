import { prisma } from '../db/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { type RecurrenceFrequency } from '../generated/prisma/client.js';


/** Next occurrence day (UTC midnight) strictly after `from`, clamped to month lengths. */
export function nextOccurrence(from: Date, frequency: RecurrenceFrequency): Date {
  const d = new Date(from);
  if (frequency === 'DAILY') {
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  if (frequency === 'WEEKLY') {
    d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }
  if (frequency === 'MONTHLY') {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, lastDay));
    return d;
  }
  // YEARLY — clamp Feb 29 → Feb 28
  const day = d.getUTCDate();
  const month = d.getUTCMonth();
  d.setUTCDate(1);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  void month;
  return d;
}

const dayString = (d: Date): string => d.toISOString().slice(0, 10);
const dayDate = (s: string): Date => new Date(`${s}T00:00:00.000Z`);
const todayUtc = (): Date => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');

export interface CreateRecurringInput {
  accountId: string;
  categoryId: string;
  type: 'INCOME' | 'EXPENSE';
  title: string;
  amountPaise: number;
  frequency: RecurrenceFrequency;
  startDate: Date;
  endDate?: Date | null;
}

export function toRecurringJson(row: {
  id: string;
  accountId: string;
  categoryId: string;
  type: string;
  title: string;
  amountPaise: bigint;
  frequency: string;
  startDate: Date;
  endDate: Date | null;
  active: boolean;
  lastRunDate: Date | null;
  nextRunDate: Date;
  account: { name: string };
  category: { name: string };
}) {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account.name,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    type: row.type,
    title: row.title,
    amountPaise: row.amountPaise.toString(),
    frequency: row.frequency,
    startDate: dayString(row.startDate),
    endDate: row.endDate ? dayString(row.endDate) : null,
    active: row.active,
    lastRunDate: row.lastRunDate ? dayString(row.lastRunDate) : null,
    nextRunDate: dayString(row.nextRunDate),
  };
}

const include = { account: true, category: true } as const;

export async function listRecurring(userId: string) {
  const rows = await prisma.recurringRule.findMany({
    where: { userId },
    include,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toRecurringJson);
}

async function assertOwned(userId: string, accountId: string, categoryId: string): Promise<void> {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true } });
  if (!account) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Pick one of your own accounts.');
  const category = await prisma.category.findFirst({
    where: { id: categoryId, OR: [{ userId: null }, { userId }] },
    select: { id: true },
  });
  if (!category) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Pick a valid category.');
}

export async function createRecurring(userId: string, input: CreateRecurringInput) {
  await assertOwned(userId, input.accountId, input.categoryId);
  const start = dayString(input.startDate);
  const row = await prisma.recurringRule.create({
    data: {
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      title: input.title,
      amountPaise: BigInt(input.amountPaise),
      frequency: input.frequency,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      nextRunDate: input.startDate,
    },
    include,
  });
  return toRecurringJson(row);
}

export async function updateRecurring(
  userId: string,
  id: string,
  input: { title?: string; amountPaise?: number; active?: boolean; endDate?: Date | null },
): Promise<void> {
  const row = await prisma.recurringRule.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'That recurring rule does not exist.');
  await prisma.recurringRule.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.amountPaise !== undefined ? { amountPaise: BigInt(input.amountPaise) } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    },
  });
}

export async function deleteRecurring(userId: string, id: string): Promise<void> {
  const row = await prisma.recurringRule.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'That recurring rule does not exist.');
  // Generated transactions stay — they are the user's ledger history.
  await prisma.recurringRule.delete({ where: { id } });
}

export interface GenerationResult {
  created: number;
  skipped: number;
  rulesProcessed: number;
}

/**
 * Books every due occurrence for the given rules (or all active rules when
 * userId is omitted — the scheduled job's mode).
 *
 * Idempotency: each booked transaction carries the deterministic occurrence
 * key `rule:{ruleId}:{YYYY-MM-DD}`, protected by a unique index. The upsert
 * makes re-running the job — twice, concurrently, or after a crash — create
 * nothing twice.
 */
export async function generateDueTransactions(userId?: string, today: Date = todayUtc()): Promise<GenerationResult> {
  const rules = await prisma.recurringRule.findMany({
    where: { active: true, ...(userId ? { userId } : {}), nextRunDate: { lte: today } },
    include,
  });

  const result: GenerationResult = { created: 0, skipped: 0, rulesProcessed: 0 };

  for (const rule of rules) {
    result.rulesProcessed++;
    const endDate = rule.endDate ? dayDate(dayString(rule.endDate)) : null;
    let cursor = dayDate(dayString(rule.nextRunDate));
    let guard = 0;
    let lastBooked: Date | null = rule.lastRunDate ? dayDate(dayString(rule.lastRunDate)) : null;

    while (cursor <= today && guard < 400) {
      guard++;
      if (endDate && cursor > endDate) break;

      const occurrenceKey = `rule:${rule.id}:${dayString(cursor)}`;
      const existing = await prisma.transaction.findUnique({ where: { occurrenceKey }, select: { id: true } });
      if (existing) {
        result.skipped++;
      } else {
        await prisma.transaction.create({
          data: {
            userId: rule.userId,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            recurringRuleId: rule.id,
            type: rule.type,
            amountPaise: rule.amountPaise,
            description: `${rule.title} (recurring)`,
            notes: `Generated from recurring rule · ${rule.frequency.toLowerCase()}`,
            transactionDate: cursor,
            occurrenceKey,
          },
        });
        result.created++;
      }
      lastBooked = cursor;
      cursor = nextOccurrence(cursor, rule.frequency);
    }

    await prisma.recurringRule.update({
      where: { id: rule.id },
      data: {
        lastRunDate: lastBooked,
        nextRunDate: cursor <= today && endDate && cursor > endDate ? cursor : cursor,
      },
    });
  }

  return result;
}

