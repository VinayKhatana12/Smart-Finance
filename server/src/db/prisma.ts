import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { isProd } from '../config/env.js';
import { logger } from '../utils/logger.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * One PrismaClient per process (tsx watch would otherwise open a new pool per
 * reload). Prisma 7 talks to Postgres through the pg driver adapter, and the
 * connection string is read from the environment **at first use** — that keeps
 * test suites able to point the same code at their own embedded database.
 */
function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? '';
  const adapter = new PrismaPg({ connectionString, max: 10 });
  return new PrismaClient({ adapter, log: isProd ? ['error'] : ['error', 'warn'] });
}

export function getPrisma(): PrismaClient {
  if (!global.__prisma) {
    global.__prisma = createClient();
    logger.info('PrismaClient created');
  }
  return global.__prisma;
}

/** Lazy proxy: `prisma.user.findMany(...)` constructs the client on first touch. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrisma();
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export async function connectDatabase(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('PostgreSQL connected (Prisma)');
    return true;
  } catch (error) {
    logger.error(`PostgreSQL connection failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (global.__prisma) await prisma.$disconnect();
}
