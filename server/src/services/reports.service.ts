import PDFDocument from 'pdfkit';
import { prisma } from '../db/prisma.js';
import { twoDecimals } from '../utils/serialize.js';
import { listBudgets } from './budgets.service.js';
import { monthKey, monthRangeInTz, parseMonthKey, safeTimeZone } from '../utils/time.js';
import type { RangeQuery } from '../validation/v1.schema.js';

const startOfDay = (d: string) => new Date(`${d}T00:00:00.000Z`);
const endOfDay = (d: string) => new Date(`${d}T23:59:59.999Z`);

export interface ReportSummary {
  incomePaise: string;
  expensePaise: string;
  netPaise: string;
  savingsRate: number | null;
  byCategory: Array<{ categoryId: string; category: string; color: string; incomePaise: string; expensePaise: string; display: string }>;
  byMonth: Array<{ month: string; incomePaise: string; expensePaise: string }>;
}

const sumFor = (userId: string, type: 'INCOME' | 'EXPENSE', from: string, to: string, categoryId?: string) =>
  prisma.transaction
    .aggregate({
      where: {
        userId,
        type,
        categoryId,
        transactionDate: { gte: startOfDay(from), lte: endOfDay(to) },
      },
      _sum: { amountPaise: true },
    })
    .then((r) => r._sum.amountPaise ?? 0n);

export async function reportSummary(userId: string, userTz: string | null, q: RangeQuery): Promise<ReportSummary> {
  safeTimeZone(userTz); // dates arrive as UTC day strings; the tz shapes month buckets below
  const incomePaise = await sumFor(userId, 'INCOME', q.from, q.to);
  const expensePaise = await sumFor(userId, 'EXPENSE', q.from, q.to);

  const grouped = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: { userId, type: { in: ['INCOME', 'EXPENSE'] }, transactionDate: { gte: startOfDay(q.from), lte: endOfDay(q.to) } },
    _sum: { amountPaise: true },
  });
  const categories = await prisma.category.findMany({
    where: { id: { in: grouped.map((g) => g.categoryId) } },
    select: { id: true, name: true, color: true },
  });
  const names = new Map(categories.map((c) => [c.id, c]));

  const byCategory = await Promise.all(
    grouped.map(async (group) => {
      const meta = names.get(group.categoryId)!;
      const [income, expense] = await Promise.all([
        sumFor(userId, 'INCOME', q.from, q.to, group.categoryId),
        sumFor(userId, 'EXPENSE', q.from, q.to, group.categoryId),
      ]);
      return {
        categoryId: group.categoryId,
        category: meta?.name ?? 'unknown',
        color: meta?.color ?? '#5c6064',
        incomePaise: income.toString(),
        expensePaise: expense.toString(),
        display: twoDecimals(expense),
      };
    }),
  );
  byCategory.sort((a, b) => (BigInt(b.expensePaise) > BigInt(a.expensePaise) ? 1 : -1));

  // report ranges are UTC day strings from the client; buckets follow those months
  const fromInstant = new Date(`${q.from}T00:00:00.000Z`);
  const toInstant = new Date(`${q.to}T23:59:59.999Z`);
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(fromInstant.getUTCFullYear(), fromInstant.getUTCMonth(), 1));
  while (cursor <= toInstant) {
    keys.push(monthKey(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const byMonth = await monthlySeries(userId, userTz, fromInstant, toInstant, keys);
  const net = incomePaise - expensePaise;

  return {
    incomePaise: incomePaise.toString(),
    expensePaise: expensePaise.toString(),
    netPaise: net.toString(),
    savingsRate: incomePaise > 0n ? Math.round((Number(net) * 1000) / Number(incomePaise)) / 10 : null,
    byCategory,
    byMonth,
  };
}

/** The N months ending with the current one, in the viewer's timezone. */
export async function monthlySeriesForMonths(userId: string, userTz: string | null, months: number) {
  const timeZone = safeTimeZone(userTz);
  const now = new Date();
  const endKey = monthKey(now.getFullYear(), now.getMonth() + 1);
  const { year, month } = parseMonthKey(endKey);
  const keys: string[] = [];
  for (let back = months - 1; back >= 0; back--) {
    const d = new Date(Date.UTC(year, month - 1 - back, 1));
    keys.push(monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1));
  }
  const [firstYear, firstMonth] = splitKey(keys[0]!);
  const [lastYear, lastMonth] = splitKey(keys[keys.length - 1]!);
  const { start } = monthRangeInTz(firstYear, firstMonth, timeZone);
  const { end } = monthRangeInTz(lastYear, lastMonth, timeZone);
  return monthlySeries(userId, userTz, start, new Date(end.getTime() - 1), keys);
}

function splitKey(key: string): [number, number] {
  const { year, month } = parseMonthKey(key);
  return [year, month];
}

/** Month series with boundaries in the user's timezone; TRANSFER rows never appear. */
export async function monthlySeries(
  userId: string,
  userTz: string | null,
  fromInstant: Date,
  toInstant: Date,
  bucketKeys: string[],
) {
  const timeZone = safeTimeZone(userTz);
  const rows = await prisma.transaction.findMany({
    where: { userId, type: { in: ['INCOME', 'EXPENSE'] }, transactionDate: { gte: fromInstant, lte: toInstant } },
    select: { type: true, amountPaise: true, transactionDate: true },
  });
  const buckets = new Map<string, { income: bigint; expense: bigint }>();
  for (const row of rows) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(row.transactionDate);
    const y = parts.find((p) => p.type === 'year')!.value;
    const m = parts.find((p) => p.type === 'month')!.value;
    const key = `${y}-${m}`;
    const bucket = buckets.get(key) ?? { income: 0n, expense: 0n };
    if (row.type === 'INCOME') bucket.income += row.amountPaise;
    else bucket.expense += row.amountPaise;
    buckets.set(key, bucket);
  }
  // every requested month appears, so charts never show gaps as missing data
  return bucketKeys.map((key) => {
    const bucket = buckets.get(key) ?? { income: 0n, expense: 0n };
    return { month: key, incomePaise: bucket.income.toString(), expensePaise: bucket.expense.toString() };
  });
}

// ---------- typed reports (monthly / annual / income / expense / savings) ----------

export interface MonthlyReport {
  period: string;
  currencyNote: string;
  incomePaise: string;
  expensePaise: string;
  netPaise: string;
  savingsRate: number | null;
  byCategory: Array<{ category: string; amountPaise: string }>;
  budgets: Array<{ category: string; limitPaise: string; spentPaise: string; percent: number }>;
  recent: Array<{ description: string; category: string; type: string; amountPaise: string; date: string }>;
}

export async function monthlyReport(userId: string, userTz: string | null, currency: string, year: number, month: number): Promise<MonthlyReport> {
  void currency;
  const tz = safeTimeZone(userTz);
  const { start, end } = monthRangeInTz(year, month, tz);
  const from = start.toISOString().slice(0, 10);
  const to = new Date(end.getTime() - 1).toISOString().slice(0, 10);
  const summary = await reportSummary(userId, userTz, { from, to });
  const budgets = await listBudgets(userId, userTz, month, year);
  const recent = await prisma.transaction.findMany({
    where: { userId, transactionDate: { gte: start, lt: end } },
    include: { category: true },
    orderBy: { transactionDate: 'desc' },
    take: 10,
  });

  return {
    period: `${year}-${String(month).padStart(2, '0')}`,
    currencyNote: currency,
    incomePaise: summary.incomePaise,
    expensePaise: summary.expensePaise,
    netPaise: summary.netPaise,
    savingsRate: summary.savingsRate,
    byCategory: summary.byCategory.map((c) => ({ category: c.category, amountPaise: c.expensePaise })),
    budgets: budgets.map((b) => ({ category: b.categoryName, limitPaise: b.limitPaise, spentPaise: b.spentPaise, percent: b.percent })),
    recent: recent.map((r) => ({
      description: r.description || r.category.name,
      category: r.category.name,
      type: r.type,
      amountPaise: r.amountPaise.toString(),
      date: r.transactionDate.toISOString().slice(0, 10),
    })),
  };
}

export interface AnnualReport {
  year: number;
  incomePaise: string;
  expensePaise: string;
  netPaise: string;
  savingsRate: number | null;
  byMonth: Array<{ month: string; incomePaise: string; expensePaise: string }>;
  byCategory: Array<{ category: string; amountPaise: string }>;
}

export async function annualReport(userId: string, userTz: string | null, year: number): Promise<AnnualReport> {
  const tz = safeTimeZone(userTz);
  const { start } = monthRangeInTz(year, 1, tz);
  const { end } = monthRangeInTz(year, 12, tz);
  const from = start.toISOString().slice(0, 10);
  const to = new Date(end.getTime() - 1).toISOString().slice(0, 10);

  const [incomePaise, expensePaise, byMonth, grouped] = await Promise.all([
    sumFor(userId, 'INCOME', from, to),
    sumFor(userId, 'EXPENSE', from, to),
    monthlySeries(userId, userTz, start, new Date(end.getTime() - 1), Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1))),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'EXPENSE', transactionDate: { gte: start, lt: end } },
      _sum: { amountPaise: true },
      orderBy: { _sum: { amountPaise: 'desc' } },
    }),
  ]);
  const categories = await prisma.category.findMany({ where: { id: { in: grouped.map((g) => g.categoryId) } }, select: { id: true, name: true } });
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? 'unknown';

  const net = incomePaise - expensePaise;
  return {
    year,
    incomePaise: incomePaise.toString(),
    expensePaise: expensePaise.toString(),
    netPaise: net.toString(),
    savingsRate: incomePaise > 0n ? Math.round((Number(net) * 1000) / Number(incomePaise)) / 10 : null,
    byMonth,
    byCategory: grouped.map((g) => ({ category: nameOf(g.categoryId), amountPaise: (g._sum.amountPaise ?? 0n).toString() })),
  };
}

/** Income or expense view for a year: monthly series + category split. */
export async function typeReport(userId: string, userTz: string | null, year: number, type: 'INCOME' | 'EXPENSE') {
  const tz = safeTimeZone(userTz);
  const { start } = monthRangeInTz(year, 1, tz);
  const { end } = monthRangeInTz(year, 12, tz);
  const from = start.toISOString().slice(0, 10);
  const to = new Date(end.getTime() - 1).toISOString().slice(0, 10);

  const [total, series, grouped] = await Promise.all([
    sumFor(userId, type, from, to),
    monthlySeries(userId, userTz, start, new Date(end.getTime() - 1), Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1))),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type, transactionDate: { gte: start, lt: end } },
      _sum: { amountPaise: true },
      orderBy: { _sum: { amountPaise: 'desc' } },
    }),
  ]);
  const categories = await prisma.category.findMany({ where: { id: { in: grouped.map((g) => g.categoryId) } }, select: { id: true, name: true } });
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? 'unknown';

  return {
    year,
    type,
    totalPaise: total.toString(),
    byMonth: series.map((m) => ({ month: m.month, amountPaise: type === 'INCOME' ? m.incomePaise : m.expensePaise })),
    byCategory: grouped.map((g) => ({ category: nameOf(g.categoryId), amountPaise: (g._sum.amountPaise ?? 0n).toString() })),
  };
}

/** Savings view: monthly net (the real "saved" figure) + goal contributions in the year. */
export async function savingsReport(userId: string, userTz: string | null, year: number) {
  const tz = safeTimeZone(userTz);
  const { start } = monthRangeInTz(year, 1, tz);
  const { end } = monthRangeInTz(year, 12, tz);
  const from = start.toISOString().slice(0, 10);
  const to = new Date(end.getTime() - 1).toISOString().slice(0, 10);

  const series = await monthlySeries(userId, userTz, start, new Date(end.getTime() - 1), Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1)));
  const contributions = await prisma.goalContribution.aggregate({
    where: { userId, contributionDate: { gte: start, lt: end } },
    _sum: { amountPaise: true },
  });
  const byGoal = await prisma.goalContribution.groupBy({
    by: ['goalId'],
    where: { userId, contributionDate: { gte: start, lt: end } },
    _sum: { amountPaise: true },
  });
  const goals = await prisma.savingsGoal.findMany({ where: { id: { in: byGoal.map((g) => g.goalId) } }, select: { id: true, title: true } });
  const titleOf = (id: string) => goals.find((g) => g.id === id)?.title ?? 'unknown';

  const totalNet = series.reduce((sum, m) => sum + (BigInt(m.incomePaise) - BigInt(m.expensePaise)), 0n);
  return {
    year,
    savedPaise: totalNet.toString(),
    contributedToGoalsPaise: (contributions._sum.amountPaise ?? 0n).toString(),
    byMonth: series.map((m) => ({ month: m.month, savedPaise: (BigInt(m.incomePaise) - BigInt(m.expensePaise)).toString() })),
    byGoal: byGoal.map((g) => ({ goal: titleOf(g.goalId), amountPaise: (g._sum.amountPaise ?? 0n).toString() })),
  };
}

// ---------- PDF ----------

/**
 * Monthly report as a real, downloadable PDF (pdfkit, Helvetica, no headless
 * browser). All figures are the user's own ledger aggregates.
 */
export async function monthlyReportPdf(userId: string, userTz: string | null, currency: string, year: number, month: number): Promise<Buffer> {
  const report = await monthlyReport(userId, userTz, currency, year, month);
  const symbol = currency === 'INR' ? 'Rs.' : `${currency} `;
  const money = (paise: string): string => `${symbol}${twoDecimals(BigInt(paise))}`;

  const doc = new PDFDocument({ margin: 56, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  doc.fontSize(20).text('Smart Finance - Monthly Report');
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor('#444').text(`Period: ${report.period} | currency: ${currency}`);
  doc.moveDown(1);

  doc.fillColor('#111').fontSize(14).text('Totals');
  doc.fontSize(12).text(`Income: ${money(report.incomePaise)}`);
  doc.text(`Expenses: ${money(report.expensePaise)}`);
  doc.text(`Net: ${money(report.netPaise)}`);
  if (report.savingsRate !== null) doc.text(`Savings rate: ${report.savingsRate}%`);
  doc.moveDown(1);

  if (report.byCategory.length > 0) {
    doc.fontSize(14).text('Spending by category');
    doc.fontSize(12);
    for (const row of report.byCategory) doc.text(`${row.category}: ${money(row.amountPaise)}`);
    doc.moveDown(1);
  }

  if (report.budgets.length > 0) {
    doc.fontSize(14).text('Budgets');
    doc.fontSize(12);
    for (const b of report.budgets) doc.text(`${b.category}: ${money(b.spentPaise)} of ${money(b.limitPaise)} (${b.percent}%)`);
    doc.moveDown(1);
  }

  if (report.recent.length > 0) {
    doc.fontSize(14).text('Recent transactions');
    doc.fontSize(12);
    for (const t of report.recent) doc.text(`${t.date} | ${t.description} | ${money(t.amountPaise)} (${t.type.toLowerCase()})`);
  }

  doc.moveDown(1.4);
  doc.fontSize(9).fillColor('#777').text(
    'Generated from your recorded transactions. Historical figures only - not a forecast, and not financial advice.',
  );

  doc.end();
  return done;
}
