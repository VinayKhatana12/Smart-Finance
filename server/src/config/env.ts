import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().default(''),
  JWT_SECRET: z.string().default(''),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SAMESITE: z.enum(['lax', 'none']).default('lax'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  logger.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) logger.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

const env = { ...parsed.data };
export const isProd = env.NODE_ENV === 'production';

if (isProd && env.JWT_SECRET.length < 32) {
  logger.error('JWT_SECRET must be at least 32 characters in production.');
  process.exit(1);
}
if (!isProd && env.JWT_SECRET === '') {
  // Dev convenience only: an ephemeral secret so sessions do not outlive the process.
  env.JWT_SECRET = randomBytes(32).toString('hex');
  logger.warn('JWT_SECRET is not set — using an ephemeral development secret. Set it in server/.env.');
}
if (isProd && env.DATABASE_URL === '') {
  logger.error('DATABASE_URL is required in production.');
  process.exit(1);
}

export const corsOrigins = env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);

export { env };
