import 'dotenv/config';
/* eslint-disable no-console */
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }) });

const SYSTEM_CATEGORIES: Array<{ name: string; type: 'INCOME' | 'EXPENSE'; icon: string; color: string }> = [
  { name: 'Salary', type: 'INCOME', icon: 'briefcase', color: '#2f7a45' },
  { name: 'Freelance', type: 'INCOME', icon: 'pen', color: '#2a8798' },
  { name: 'Investment', type: 'INCOME', icon: 'trending-up', color: '#1d5fd6' },
  { name: 'Other income', type: 'INCOME', icon: 'plus', color: '#5c6064' },
  { name: 'Groceries', type: 'EXPENSE', icon: 'basket', color: '#1d5fd6' },
  { name: 'Eating out', type: 'EXPENSE', icon: 'cup', color: '#b45309' },
  { name: 'Transport', type: 'EXPENSE', icon: 'bus', color: '#2a8798' },
  { name: 'Housing', type: 'EXPENSE', icon: 'home', color: '#7c4a03' },
  { name: 'Utilities', type: 'EXPENSE', icon: 'bolt', color: '#0a3a80' },
  { name: 'Health', type: 'EXPENSE', icon: 'heart', color: '#c41c29' },
  { name: 'Entertainment', type: 'EXPENSE', icon: 'film', color: '#6d28d9' },
  { name: 'Shopping', type: 'EXPENSE', icon: 'bag', color: '#be185d' },
  { name: 'Education', type: 'EXPENSE', icon: 'book', color: '#1d4ed8' },
  { name: 'Other', type: 'EXPENSE', icon: 'tag', color: '#5c6064' },
];

/**
 * Idempotent seed:
 *  1. system categories (shared by every user — userId null)
 *  2. one clearly-marked demo user with a random password, printed once
 *
 * The demo user is real infrastructure for trying the app locally; it is never
 * referenced by the product UI as sample content. Run with `npm run db:seed`.
 */
async function main(): Promise<void> {
  let created = 0;
  for (const category of SYSTEM_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { userId: null, name: category.name, type: category.type },
      select: { id: true },
    });
    if (existing) {
      await prisma.category.update({ where: { id: existing.id }, data: { icon: category.icon, color: category.color } });
    } else {
      await prisma.category.create({ data: { userId: null, ...category } });
      created++;
    }
  }
  console.info(`seeded ${created} new system categories (${SYSTEM_CATEGORIES.length} total)`);

  const email = 'demo@smartfinance.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.info(`demo user already exists: ${email}`);
    return;
  }
  const password = `demo-${randomBytes(6).toString('hex')}`;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name: 'Demo User', email, passwordHash, currency: 'INR', timezone: 'Asia/Kolkata' },
  });
  console.info('demo user created — sign in locally with:');
  console.info(`  email:    ${email}`);
  console.info(`  password: ${password}`);
  void user;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
