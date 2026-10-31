import { prisma } from '../db/prisma.js';
import { twoDecimals } from '../utils/serialize.js';
import { monthRangeInTz, monthKey, parseMonthKey, safeTimeZone, shiftMonthKey, currentMonthKey } from '../utils/time.js';
import { listBudgets } from './budgets.service.js';

export interface Insight {
  kind: string;
  severity: 'info' | 'positive' | 'warning';
  title: string;
  detail: string;
}

const fmt = (paise: string, symbol: string) => `${symbol}${twoDecimals(BigInt(paise))}`;

/**
 * Rule-based observations about the requested month. Every figure is computed
 * from the ledger; comparisons are labelled with their baseline and hedged
 * where they estimate. Nothing here predicts or guarantees anything.
 */
export async function spendingInsights(userId: string, userTz: string | null, currency: string, monthInput?: string): Promise<Insight[]> {
  const key = monthInput ?? currentMonthKey();
  const { year, month } = parseMonthKey(key);
  const timeZone = safeTimeZone(userTz);
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  const prevKey = shiftMonthKey(key, -1);

  const { start, end } = monthRangeInTz(year, month, timeZone);
  const prev = parseMonthKey(prevKey);
  const prevRange = monthRangeInTz(prev.year, prev.month, timeZone);

  const [totals, prevTotals, byCategory, budgets] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId, type: { in: ['INCOME', 'EXPENSE'] }, transactionDate: { gte: start, lt: end } },
      _sum: { amountPaise: true },
    }),
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId, type: { in: ['INCOME', 'EXPENSE'] }, transactionDate: { gte: prevRange.start, lt: prevRange.end } },
      _sum: { amountPaise: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'EXPENSE', transactionDate: { gte: start, lt: end } },
      _sum: { amountPaise: true },
      orderBy: { _sum: { amountPaise: 'desc' } },
    }),
    listBudgets(userId, userTz, month, year),
  ]);

  const sumOf = (groups: Array<{ type: string; _sum: { amountPaise: bigint | null } }>, type: string): bigint =>
    BigInt(groups.find((g) => g.type === type)?._sum.amountPaise ?? 0);

  const income = sumOf(totals, 'INCOME');
  const expense = sumOf(totals, 'EXPENSE');
  const prevExpense = sumOf(prevTotals, 'EXPENSE');
  const prevIncome = sumOf(prevTotals, 'INCOME');
  const insights: Insight[] = [];

  // 1. Highest spending category
  if (byCategory.length > 0) {
    const names = await prisma.category.findMany({ where: { id: { in: byCategory.map((c) => c.categoryId) } }, select: { id: true, name: true } });
    const nameOf = (id: string) => names.find((c) => c.id === id)?.name ?? 'unknown';
    const top = byCategory[0]!;
    const topPaise = top._sum.amountPaise ?? 0n;
    const share = expense > 0n ? Math.round((Number(topPaise) * 100) / Number(expense)) : 0;
    insights.push({
      kind: 'top-category',
      severity: 'info',
      title: `${nameOf(top.categoryId)} was your biggest expense`,
      detail: `${nameOf(top.categoryId)} accounted for ${fmt(topPaise.toString(), symbol)} — about ${share}% of this month's spending across ${byCategory.length} categor${byCategory.length === 1 ? 'y' : 'ies'}.`,
    });

    // 2. Unusual increases: this month > 1.5 × the average of the previous three months, with a floor
    const threeKeys = [shiftMonthKey(key, -3), shiftMonthKey(key, -2), prevKey];
    const baseline: Array<Record<string, bigint>> = [];
    for (const k of threeKeys) {
      const p = parseMonthKey(k);
      const r = monthRangeInTz(p.year, p.month, timeZone);
      const groups = await prisma.transaction.groupBy({
        by: ['categoryId', 'type'],
        where: { userId, categoryId: top.categoryId, type: 'EXPENSE', transactionDate: { gte: r.start, lt: r.end } },
        _sum: { amountPaise: true },
      });
      baseline.push({ spent: sumOf(groups.map((g) => ({ type: g.type, _sum: g._sum })), 'EXPENSE') });
    }
    const avgPrev = baseline.reduce((s, b) => s + b.spent, 0n) / 3n;
    if (avgPrev > 0n && topPaise > (avgPrev * 3n) / 2n) {
      const pct = Math.round((Number(topPaise - avgPrev) * 100) / Number(avgPrev));
      insights.push({
        kind: 'unusual-increase',
        severity: 'warning',
        title: `${nameOf(top.categoryId)} spending is up versus recent months`,
        detail: `This month's ${fmt(topPaise.toString(), symbol)} is about ${pct}% above the average of the previous three months (${fmt(avgPrev.toString(), symbol)}). Worth a look, not a verdict — one large purchase can explain it.`,
      });
    }
  }

  // 3. Month-over-month expense change
  if (prevExpense > 0n || expense > 0n) {
    const diff = expense - prevExpense;
    if (prevExpense > 0n) {
      const pct = Math.round((Number(diff < 0n ? -diff : diff) * 100) / Number(prevExpense));
      const direction = diff === 0n ? 'flat against' : diff > 0n ? `${pct}% above` : `${pct}% below`;
      insights.push({
        kind: 'mom-expense',
        severity: diff > 0n ? 'warning' : 'positive',
        title: `Expenses ${diff > 0n ? 'rose' : diff < 0n ? 'fell' : 'held'} versus last month`,
        detail: `${fmt(expense.toString(), symbol)} this month — ${direction} last month's ${fmt(prevExpense.toString(), symbol)}.`,
      });
    } else {
      insights.push({
        kind: 'mom-expense',
        severity: 'info',
        title: 'First month with expenses',
        detail: `Last month had no recorded expenses, so there is no baseline to compare ${fmt(expense.toString(), symbol)} against.`,
      });
    }
  }

  // 4. Savings rate (with last month's for context)
  if (income > 0n) {
    const net = income - expense;
    const rate = Math.round((Number(net) * 1000) / Number(income)) / 10;
    let context = '';
    if (prevIncome > 0n) {
      const prevNet = prevIncome - prevExpense;
      const prevRate = Math.round((Number(prevNet) * 1000) / Number(prevIncome)) / 10;
      context = ` Last month's rate was ${prevRate}%.`;
    }
    insights.push({
      kind: 'savings-rate',
      severity: rate >= 20 ? 'positive' : rate >= 0 ? 'info' : 'warning',
      title: `You kept ${rate}% of your income`,
      detail: `Income ${fmt(income.toString(), symbol)} minus expenses ${fmt(expense.toString(), symbol)} leaves ${fmt(net.toString(), symbol)}.${context}`,
    });
  }

  // 5. Average daily spending — days elapsed in the month (in the user's zone), so a
  //    partial month is not extrapolated into a verdict.
  const today = new Date();
  const todayParts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(today);
  const todayKey = `${todayParts.find((p) => p.type === 'year')!.value}-${todayParts.find((p) => p.type === 'month')!.value}-${todayParts.find((p) => p.type === 'day')!.value}`;
  const lastDay = monthRangeInTz(year, month, timeZone).end;
  const daysInMonth = Number(lastDay.toISOString().slice(8, 10));
  const isCurrentMonth = key === currentMonthKey();
  const todayNum = Number(todayKey.slice(8, 10));
  const daysElapsed = isCurrentMonth && todayNum <= daysInMonth ? todayNum : daysInMonth;
  if (expense > 0n && daysElapsed > 0) {
    const perDay = expense / BigInt(daysElapsed);
    insights.push({
      kind: 'daily-spend',
      severity: 'info',
      title: `About ${fmt(perDay.toString(), symbol)} a day`,
      detail: `Average daily spending over ${daysElapsed} day${daysElapsed === 1 ? '' : 's'} of ${monthKey(year, month)}. Based on recorded transactions only.`,
    });
  }

  // 6. Budget usage patterns
  const over = budgets.filter((b) => b.percent > 100);
  const near = budgets.filter((b) => b.percent >= 80 && b.percent <= 100);
  if (budgets.length > 0) {
    if (over.length > 0) {
      insights.push({
        kind: 'budget-usage',
        severity: 'warning',
        title: `${over.length} budget${over.length === 1 ? '' : 's'} exceeded`,
        detail: `${over.map((b) => `${b.categoryName} (${b.percent}%)`).join(', ')} passed their limits. The rest are holding.`,
      });
    } else if (near.length > 0) {
      insights.push({
        kind: 'budget-usage',
        severity: 'warning',
        title: `${near.length} budget${near.length === 1 ? '' : 's'} past 80%`,
        detail: `${near.map((b) => `${b.categoryName} (${b.percent}%)`).join(', ')} are close to their limits; the other ${budgets.length - near.length} are holding.`,
      });
    } else {
      insights.push({
        kind: 'budget-usage',
        severity: 'positive',
        title: `All ${budgets.length} budget${budgets.length === 1 ? '' : 's'} holding`,
        detail: 'Every limit is under 80% for this month.',
      });
    }
  }

  return insights;
}

/** What-if helper for the assistant: reducing a category's spending by X% this month. */
export function whatIfReduction(currentPaise: bigint, percent: number): { savedPaise: bigint; newPaise: bigint } {
  const clamped = Math.max(0, Math.min(100, percent));
  const saved = (currentPaise * BigInt(clamped)) / 100n;
  return { savedPaise: saved, newPaise: currentPaise - saved };
}
