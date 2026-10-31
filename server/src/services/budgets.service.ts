import { prisma } from '../db/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { twoDecimals } from '../utils/serialize.js';
import { monthRangeInTz, safeTimeZone } from '../utils/time.js';
import type { CreateBudgetInput } from '../validation/v1.schema.js';

export interface BudgetWithSpent {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  month: number;
  year: number;
  limitPaise: string;
  spentPaise: string;
  remainingPaise: string;
  percent: number;
}

/**
 * Spent is the user's real expense transactions inside the civil month — with
 * the month boundaries drawn in the user's own timezone, as the business rules
 * require. Never stored, so it can never disagree with the ledger.
 */
export async function listBudgets(userId: string, userTz: string | null, month: number, year: number): Promise<BudgetWithSpent[]> {
  const timeZone = safeTimeZone(userTz);
  const { start, end } = monthRangeInTz(year, month, timeZone);

  const budgets = await prisma.budget.findMany({
    where: { userId, month, year },
    include: { category: true },
    orderBy: { category: { name: 'asc' } },
  });

  const spentRows = await prisma.$queryRaw<{ category_id: string; spent: bigint }[]>`
    SELECT t.category_id, COALESCE(SUM(t.amount_paise), 0::bigint) AS spent
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ${userId}::uuid
      AND t.type = 'EXPENSE'
      AND t.transaction_date >= ${start} AND t.transaction_date < ${end}
      AND c.type = 'EXPENSE'
    GROUP BY t.category_id
  `;
  // the pg adapter delivers int8 aggregates as strings — normalise to bigint
  const spentByCategory = new Map(spentRows.map((r) => [r.category_id, BigInt(r.spent)]));

  return budgets.map((budget) => {
    const spent = spentByCategory.get(budget.categoryId) ?? 0n;
    const percent = budget.limitPaise > 0n ? Number((spent * 100n) / budget.limitPaise) : 0;
    return {
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      categoryColor: budget.category.color,
      month: budget.month,
      year: budget.year,
      limitPaise: budget.limitPaise.toString(),
      spentPaise: spent.toString(),
      remainingPaise: (budget.limitPaise - spent).toString(),
      percent: Math.min(999, percent),
    };
  });
}

export async function createBudget(userId: string, input: CreateBudgetInput): Promise<BudgetWithSpent> {
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, OR: [{ userId: null }, { userId }], type: 'EXPENSE' },
    select: { id: true, name: true, color: true },
  });
  if (!category) {
    throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Budgets apply to your expense categories.');
  }
  const budget = await prisma.budget.upsert({
    where: { userId_categoryId_month_year: { userId, categoryId: input.categoryId, month: input.month, year: input.year } },
    update: { limitPaise: BigInt(input.limitPaise) },
    create: { userId, categoryId: input.categoryId, month: input.month, year: input.year, limitPaise: BigInt(input.limitPaise) },
    include: { category: true },
  });
  // spent arrives on the next list call; zero is the honest value at creation time
  return {
    id: budget.id,
    categoryId: budget.categoryId,
    categoryName: budget.category.name,
    categoryColor: budget.category.color,
    month: budget.month,
    year: budget.year,
    limitPaise: budget.limitPaise.toString(),
    spentPaise: '0',
    remainingPaise: budget.limitPaise.toString(),
    percent: 0,
  };
}

export async function updateBudget(userId: string, id: string, limitPaise: number): Promise<void> {
  const row = await prisma.budget.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'That budget does not exist.');
  await prisma.budget.update({ where: { id }, data: { limitPaise: BigInt(limitPaise) } });
}

export async function deleteBudget(userId: string, id: string): Promise<void> {
  const row = await prisma.budget.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'That budget does not exist.');
  await prisma.budget.delete({ where: { id } });
}

export { twoDecimals };
