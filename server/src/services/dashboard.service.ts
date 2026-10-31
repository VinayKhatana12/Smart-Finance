import { prisma } from '../db/prisma.js';
import { twoDecimals } from '../utils/serialize.js';
import { listAccounts } from './accounts.service.js';
import { listBudgets } from './budgets.service.js';
import { listGoals } from './goals.service.js';
import { monthlySeries } from './reports.service.js';
import { monthRangeInTz, safeTimeZone } from '../utils/time.js';
import * as reportsService from './reports.service.js';
import { evaluateBudgetNotifications } from './notifications.service.js';

export interface DashboardSummary {
  totalBalancePaise: string;
  incomePaise: string;
  expensePaise: string;
  netPaise: string;
  savingsRate: number | null;
  accounts: Array<{ id: string; name: string; accountType: string; balancePaise: string }>;
  alerts: Array<{ severity: 'warning' | 'danger' | 'info'; message: string }>;
}

export async function dashboardSummary(userId: string, userTz: string | null, month: number, year: number): Promise<DashboardSummary> {
  const timeZone = safeTimeZone(userTz);
  const { start, end } = monthRangeInTz(year, month, timeZone);
  const from = start.toISOString().slice(0, 10);
  const to = new Date(end.getTime() - 1).toISOString().slice(0, 10);

  const [accounts, income, expense, budgetRows, goalRows] = await Promise.all([
    listAccounts(userId),
    prisma.transaction.aggregate({
      where: { userId, type: 'INCOME', transactionDate: { gte: start, lt: end } },
      _sum: { amountPaise: true },
    }).then((r) => r._sum.amountPaise ?? 0n),
    prisma.transaction.aggregate({
      where: { userId, type: 'EXPENSE', transactionDate: { gte: start, lt: end } },
      _sum: { amountPaise: true },
    }).then((r) => r._sum.amountPaise ?? 0n),
    listBudgets(userId, userTz, month, year),
    prisma.savingsGoal.findMany({ where: { userId }, include: { contributions: { select: { amountPaise: true } } } }),
  ]);

  // Budget thresholds are evaluated here and by the scheduled job; the dedup
  // key guarantees one notification per budget per threshold per month.
  await evaluateBudgetNotifications(userId, userTz, month, year);

  const totalBalancePaise = accounts.reduce((sum, a) => sum + BigInt(a.balancePaise), 0n);
  const net = income - expense;
  const savingsRate = income > 0n ? Math.round((Number(net) * 1000) / Number(income)) / 10 : null;

  const alerts: DashboardSummary['alerts'] = [];
  for (const budget of budgetRows) {
    if (budget.percent >= 100) {
      alerts.push({ severity: 'danger', message: `${budget.categoryName} is over budget — ${budget.percent}% of the limit used.` });
    } else if (budget.percent >= 90) {
      alerts.push({ severity: 'warning', message: `${budget.categoryName} is at ${budget.percent}% of its limit.` });
    }
  }
  for (const goal of goalRows) {
    if (goal.status === 'ACTIVE' && goal.deadline) {
      const saved = goal.contributions.reduce((sum, c) => sum + c.amountPaise, 0n);
      const percent = goal.targetPaise > 0n ? Math.min(100, Number((saved * 100n) / goal.targetPaise)) : 0;
      const days = Math.ceil((goal.deadline.getTime() - Date.now()) / 86_400_000);
      if (days >= 0 && days <= 30 && percent < 100) {
        alerts.push({ severity: 'info', message: `${goal.title} is ${percent}% funded with ${days} day${days === 1 ? '' : 's'} left.` });
      }
    }
  }
  for (const account of accounts) {
    if (BigInt(account.balancePaise) < 0n) {
      alerts.push({ severity: 'danger', message: `${account.name} is overdrawn.` });
    }
  }
  alerts.sort((a, b) => (a.severity === 'danger' ? -1 : b.severity === 'danger' ? 1 : 0));

  return {
    totalBalancePaise: totalBalancePaise.toString(),
    incomePaise: income.toString(),
    expensePaise: expense.toString(),
    netPaise: net.toString(),
    savingsRate,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, accountType: a.accountType, balancePaise: a.balancePaise })),
    alerts: alerts.slice(0, 5),
  };
}

export async function dashboardTrends(userId: string, userTz: string | null, months: number) {
  const timeZone = safeTimeZone(userTz);
  const now = new Date();
  const endMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const series = await reportsService.monthlySeriesForMonths(userId, userTz, months);
  return series;
}

export async function dashboardCategories(userId: string, userTz: string | null, month: number, year: number) {
  const timeZone = safeTimeZone(userTz);
  const { start, end } = monthRangeInTz(year, month, timeZone);
  const grouped = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: { userId, type: 'EXPENSE', transactionDate: { gte: start, lt: end } },
    _sum: { amountPaise: true },
    orderBy: { _sum: { amountPaise: 'desc' } },
    take: 8,
  });
  const categories = await prisma.category.findMany({
    where: { id: { in: grouped.map((g) => g.categoryId) } },
    select: { id: true, name: true, color: true },
  });
  const names = new Map(categories.map((c) => [c.id, c]));
  return grouped.map((group) => {
    const meta = names.get(group.categoryId)!;
    const spent = group._sum.amountPaise ?? 0n;
    return {
      categoryId: group.categoryId,
      category: meta?.name ?? 'unknown',
      color: meta?.color ?? '#5c6064',
      expensePaise: spent.toString(),
      display: twoDecimals(spent),
    };
  });
}

export async function dashboardRecent(userId: string, take = 6) {
  const rows = await prisma.transaction.findMany({
    where: { userId },
    include: { category: true, account: true, transferAccount: true },
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    take,
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    amountPaise: row.amountPaise.toString(),
    categoryId: row.categoryId,
    categoryName: row.category.name,
    description: row.description,
    accountName: row.account.name,
    transferAccountName: row.transferAccount?.name ?? null,
    transactionDate: row.transactionDate.toISOString(),
  }));
}
