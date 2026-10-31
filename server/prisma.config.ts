import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 keeps connection URLs out of schema.prisma. The CLI (migrate, db
 * push, studio) reads the datasource URL from here; the runtime client takes
 * its adapter from src/db/prisma.ts.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
