import 'dotenv/config';
import type { Server } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase, prisma } from './db/prisma.js';
import { env, isProd } from './config/env.js';
import { logger } from './utils/logger.js';
import { generateDueTransactions } from './services/recurring.service.js';
import { evaluateBudgetNotifications } from './services/notifications.service.js';
import { monthRangeInTz, currentMonthKey, parseMonthKey } from './utils/time.js';

async function bootstrap(): Promise<Server> {
  const connected = await connectDatabase();
  if (!connected) {
    if (isProd) {
      logger.error('Cannot start in production without a database connection.');
      process.exit(1);
    }
    logger.warn('Running without a database. Health check will report db: "disconnected"; data endpoints will fail.');
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Smart Finance API v1 listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
  return server;
}

const server = await bootstrap();

function shutdown(signal: string): void {
  logger.info(`${signal} received — closing server…`);
  server.close(async () => {
    await disconnectDatabase();
    logger.info('Server closed cleanly.');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`);
});

/**
 * Scheduled backend jobs: recurring-transaction generation + budget-threshold
 * notifications. Idempotent by construction (occurrence keys, dedup keys), so
 * ticks can overlap or repeat safely. Runs at boot and every 15 minutes.
 */
const SCHEDULER_DISABLED = process.env.DISABLE_SCHEDULER === 'true' || env.NODE_ENV === 'test';

async function runScheduledJobs(): Promise<void> {
  try {
    const generated = await generateDueTransactions();
    if (generated.created > 0) {
      logger.info(`Scheduler booked ${generated.created} recurring transaction(s) across ${generated.rulesProcessed} rule(s)`);
    }
  } catch (error) {
    logger.error(`Recurring generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    const { year, month } = parseMonthKey(currentMonthKey());
    const users = await prisma.user.findMany({ select: { id: true, timezone: true } });
    for (const user of users) {
      const tz = user.timezone ?? 'UTC';
      const { start } = monthRangeInTz(year, month, tz);
      const hasSpend = await prisma.transaction.findFirst({
        where: { userId: user.id, transactionDate: { gte: start } },
        select: { id: true },
      });
      if (hasSpend) {
        await evaluateBudgetNotifications(user.id, user.timezone, month, year);
      }
    }
  } catch (error) {
    logger.error(`Budget notification evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (!SCHEDULER_DISABLED) {
  const timer = setInterval(() => {
    void runScheduledJobs();
  }, 15 * 60 * 1000);
  timer.unref();
  logger.info('Scheduler started (recurring generation + budget notifications, every 15 minutes)');
  void runScheduledJobs();
}
