import { prisma } from '../db/prisma.js';
import { safeTimeZone } from '../utils/time.js';
import { listBudgets } from './budgets.service.js';

export interface PushNotificationInput {
  type: 'BUDGET_WARNING' | 'BUDGET_LIMIT' | 'BUDGET_EXCEEDED' | 'RECURRING_BOOKED' | 'SYSTEM';
  severity: 'info' | 'warning' | 'danger';
  title: string;
  body: string;
  dedupKey?: string;
}

/**
 * Inserts a notification. When a dedupKey is given, an existing notification
 * with the same key for the same user wins — the insert is silently skipped,
 * so no matter how often thresholds are evaluated, duplicates cannot accrue.
 */
export async function push(userId: string, input: PushNotificationInput): Promise<void> {
  if (input.dedupKey) {
    const existing = await prisma.notification.findUnique({
      where: { userId_dedupKey: { userId, dedupKey: input.dedupKey } },
      select: { id: true },
    });
    if (existing) return;
    await prisma.notification.create({
      data: {
        userId,
        type: input.type,
        severity: input.severity,
        title: input.title,
        body: input.body,
        dedupKey: input.dedupKey,
      },
    });
    return;
  }
  await prisma.notification.create({
    data: { userId, type: input.type, severity: input.severity, title: input.title, body: input.body },
  });
}

export async function listNotifications(userId: string, unreadOnly: boolean) {
  const rows = await prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const unread = await prisma.notification.count({ where: { userId, readAt: null } });
  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      body: row.body,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
    })),
    unread,
  };
}

export async function markRead(userId: string, id: string): Promise<void> {
  const row = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) throw new (await import('../utils/ApiError.js')).ApiError(404, 'NOT_FOUND', 'That notification does not exist.');
  await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

export async function clearNotification(userId: string, id: string): Promise<void> {
  const row = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) throw new (await import('../utils/ApiError.js')).ApiError(404, 'NOT_FOUND', 'That notification does not exist.');
  await prisma.notification.delete({ where: { id } });
}

/**
 * Budget thresholds for one month, evaluated idempotently. Safe to call from a
 * request handler, a cron tick, or both at once — the dedup key absorbs races.
 */
export async function evaluateBudgetNotifications(userId: string, userTz: string | null, month: number, year: number): Promise<void> {
  const budgets = await listBudgets(userId, userTz, month, year);
  const timeZone = safeTimeZone(userTz);
  const monthTag = `${year}-${String(month).padStart(2, '0')}`;

  for (const budget of budgets) {
    const name = budget.categoryName;
    if (budget.percent > 100) {
      await push(userId, {
        type: 'BUDGET_EXCEEDED',
        severity: 'danger',
        title: `${name} is over budget`,
        body: `Spent ${budget.percent}% of the ${monthTag} limit for ${name}. The overrun shows on your dashboard.`,
        dedupKey: `budget:${budget.id}:exceeded:${monthTag}`,
      });
    }
    if (budget.percent >= 100) {
      await push(userId, {
        type: 'BUDGET_LIMIT',
        severity: 'warning',
        title: `${name} reached its limit`,
        body: `${name} hit 100% of its ${monthTag} budget.`,
        dedupKey: `budget:${budget.id}:100:${monthTag}`,
      });
    } else if (budget.percent >= 80) {
      await push(userId, {
        type: 'BUDGET_WARNING',
        severity: 'warning',
        title: `${name} is near its limit`,
        body: `${name} is at ${budget.percent}% of its ${monthTag} budget.`,
        dedupKey: `budget:${budget.id}:80:${monthTag}`,
      });
    }
  }
  void timeZone;
}
