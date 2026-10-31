import { prisma } from '../db/prisma.js';
import { twoDecimals } from '../utils/serialize.js';
import { monthRangeInTz, parseMonthKey, safeTimeZone, currentMonthKeyInTz } from '../utils/time.js';
import { listBudgets } from './budgets.service.js';

export interface AssistantAnswer {
  source: 'rules' | 'llm';
  answer: string;
  figures: Array<{ label: string; value: string }>;
  disclaimer: string;
}

const DISCLAIMER_RULES =
  'Figures are computed from your recorded transactions for the stated period — historical facts, not predictions. This is not financial advice and not a guaranteed outcome.';
const DISCLAIMER_LLM =
  'Figures marked as facts come from your recorded transactions; any interpretation is an estimate, not a prediction, and nothing here is financial advice.';

const symbolFor = (currency: string): string => (currency === 'INR' ? '₹' : `${currency} `);
const fmt = (paise: bigint, symbol: string) => `${symbol}${twoDecimals(paise)}`;

interface MonthFacts {
  income: bigint;
  expense: bigint;
  net: bigint;
  topCategory: { name: string; paise: bigint } | null;
  categorySpend: Array<{ name: string; paise: bigint }>;
  budgets: Array<{ name: string; percent: number; exceeded: boolean; limitPaise: bigint; spentPaise: bigint }>;
}

async function monthFacts(userId: string, tz: string, currency: string, monthKeyStr: string): Promise<MonthFacts> {
  const { year, month } = parseMonthKey(monthKeyStr);
  const { start, end } = monthRangeInTz(year, month, tz);

  const [groups, budgetRows] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where: { userId, type: { in: ['INCOME', 'EXPENSE'] }, transactionDate: { gte: start, lt: end } },
      _sum: { amountPaise: true },
    }),
    listBudgets(userId, tz, month, year),
  ]);
  const categoryIds = groups.map((g) => g.categoryId);
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } });
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? 'unknown';

  const income = BigInt(groups.find((g) => g.type === 'INCOME')?._sum.amountPaise ?? 0);
  const expense = BigInt(groups.find((g) => g.type === 'EXPENSE')?._sum.amountPaise ?? 0);
  const categorySpend = groups
    .filter((g) => g.type === 'EXPENSE')
    .map((g) => ({ name: nameOf(g.categoryId), paise: g._sum.amountPaise ?? 0n }))
    .sort((x, y) => (y.paise > x.paise ? 1 : -1));

  return {
    income,
    expense,
    net: income - expense,
    topCategory: categorySpend[0] ?? null,
    categorySpend,
    budgets: budgetRows.map((b) => ({
      name: b.categoryName,
      percent: b.percent,
      exceeded: b.percent > 100,
      limitPaise: BigInt(b.limitPaise),
      spentPaise: BigInt(b.spentPaise),
    })),
  };
}

/**
 * Rule-based answers over the signed-in user's own aggregates for the current
 * month. Recognised intents; anything else gets a summary and suggestions.
 * No identifiers, notes, or credentials ever leave the server — only sums.
 */
export async function answer(userId: string, userTz: string | null, currency: string, question: string): Promise<AssistantAnswer> {
  const tz = safeTimeZone(userTz);
  const monthKeyStr = currentMonthKeyInTz(tz);
  const { year, month } = parseMonthKey(monthKeyStr);
  const facts = await monthFacts(userId, tz, currency, monthKeyStr);
  const symbol = symbolFor(currency);
  const q = question.toLowerCase();
  const figures: AssistantAnswer['figures'] = [
    { label: 'Income this month', value: fmt(facts.income, symbol) },
    { label: 'Expenses this month', value: fmt(facts.expense, symbol) },
    { label: 'Net cash flow', value: fmt(facts.net, symbol) },
  ];

  const pctMatch = q.match(/(\d{1,2})\s*%/);
  const reduceMatch = q.match(/reduce\s+([a-z0-9 ]+)\s+spending\s+by\s+(\d{1,2})\s*%/i);

  // Intent: which category exceeded budgets
  if (/(exceed|over budget|over the budget|past.*limit)/.test(q)) {
    const exceeded = facts.budgets.filter((b) => b.exceeded);
    if (exceeded.length === 0) {
      return {
        source: 'rules',
        answer: `No budget was exceeded in ${monthKeyStr}. ${facts.budgets.length > 0 ? `All ${facts.budgets.length} of your budgets are holding.` : 'You have no budgets set for this month.'}`,
        figures,
        disclaimer: DISCLAIMER_RULES,
      };
    }
    return {
      source: 'rules',
      answer: `${exceeded.length} budget${exceeded.length === 1 ? '' : 's'} exceeded in ${monthKeyStr}: ${exceeded
        .map((b) => `${b.name} at ${b.percent}% (${fmt(b.spentPaise, symbol)} of ${fmt(b.limitPaise, symbol)})`)
        .join('; ')}.`,
      figures,
      disclaimer: DISCLAIMER_RULES,
    };
  }

  // Intent: reduce <category> spending by N%
  if (reduceMatch && facts.categorySpend.length > 0) {
    const percent = Number(pctMatch?.[1] ?? reduceMatch[2]);
    const wanted = reduceMatch[1].trim().toLowerCase();
    const match =
      facts.categorySpend.find((c) => c.name.toLowerCase() === wanted) ??
      facts.categorySpend.find((c) => c.name.toLowerCase().includes(wanted)) ??
      (wanted.includes('food') ? facts.categorySpend.find((c) => /food|grocer|eat/.test(c.name.toLowerCase())) : undefined);
    if (match && percent >= 0 && percent <= 100) {
      const saved = (match.paise * BigInt(percent)) / 100n;
      return {
        source: 'rules',
        answer: `You spent ${fmt(match.paise, symbol)} on ${match.name} this month. Cutting it by ${percent}% would have saved about ${fmt(saved, symbol)} — an estimate over the recorded spend, not a forecast of future months.`,
        figures: [
          { label: `${match.name} spent`, value: fmt(match.paise, symbol) },
          { label: `Estimated saving at −${percent}%`, value: fmt(saved, symbol) },
        ],
        disclaimer: DISCLAIMER_RULES,
      };
    }
  }

  // Intent: how much did I save
  if (/(save|saved|saving)/.test(q)) {
    return {
      source: 'rules',
      answer:
        facts.income > 0n
          ? `In ${monthKeyStr} you recorded ${fmt(facts.income, symbol)} of income and ${fmt(facts.expense, symbol)} of expenses, so ${fmt(facts.net, symbol)} stayed unspent — about ${Math.round((Number(facts.net) * 100) / Number(facts.income))}% of income. Savings-goal contributions are tracked separately on the Goals page.`
          : `No income was recorded for ${monthKeyStr}, so a savings rate cannot be computed. Expenses so far: ${fmt(facts.expense, symbol)}.`,
      figures,
      disclaimer: DISCLAIMER_RULES,
    };
  }

  // Intent: where did I spend the most
  if (/(most|top|biggest|highest|spend)/.test(q) && facts.topCategory) {
    return {
      source: 'rules',
      answer: `Your biggest spending category this month is ${facts.topCategory.name} at ${fmt(facts.topCategory.paise, symbol)}, of ${fmt(facts.expense, symbol)} total expenses. Next: ${facts.categorySpend
        .slice(1, 3)
        .map((c) => `${c.name} ${fmt(c.paise, symbol)}`)
        .join(', ')}.`,
      figures,
      disclaimer: DISCLAIMER_RULES,
    };
  }

  // Fallback summary
  return {
    source: 'rules',
    answer: `Here is ${monthKeyStr} at a glance: income ${fmt(facts.income, symbol)}, expenses ${fmt(facts.expense, symbol)}, net ${fmt(facts.net, symbol)}.${
      facts.topCategory ? ` Biggest expense: ${facts.topCategory.name} (${fmt(facts.topCategory.paise, symbol)}).` : ''
    } Try asking "where did I spend the most money?", "how much did I save this month?", "which categories exceeded my budgets?", or "how much can I save if I reduce food spending by 10%?"`,
    figures,
    disclaimer: DISCLAIMER_RULES,
  };
}

/**
 * Optional LLM refinement. Only the aggregate figures above (and the question)
 * are sent — never names beyond category names the user created, never emails,
 * notes, tokens, or credentials. If no key is configured or the call fails,
 * the rule-based answer stands on its own.
 */
export async function answerWithLlmIfConfigured(
  userId: string,
  userTz: string | null,
  currency: string,
  question: string,
): Promise<AssistantAnswer> {
  const ruleBased = await answer(userId, userTz, currency, question);
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return ruleBased;

  const tz = safeTimeZone(userTz);
  const { year, month } = parseMonthKey(currentMonthKeyInTz(tz));
  const { start, end } = monthRangeInTz(year, month, tz);
  const txns = await prisma.transaction.groupBy({
    by: ['categoryId', 'type'],
    where: { userId, type: { in: ['INCOME', 'EXPENSE'] }, transactionDate: { gte: start, lt: end } },
    _sum: { amountPaise: true },
  });
  const categories = await prisma.category.findMany({ where: { id: { in: txns.map((t) => t.categoryId) } }, select: { id: true, name: true } });
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? 'unknown';

  const aggregates = {
    period: currentMonthKeyInTz(tz),
    currency,
    income: twoDecimals(BigInt(txns.find((t) => t.type === 'INCOME')?._sum.amountPaise ?? '0')),
    expenses: twoDecimals(BigInt(txns.find((t) => t.type === 'EXPENSE')?._sum.amountPaise ?? '0')),
    byCategory: txns
      .filter((t) => t.type === 'EXPENSE')
      .map((t) => ({ category: nameOf(t.categoryId), spent: twoDecimals(BigInt(t._sum.amountPaise ?? '0')) })),
  };

  try {
    const base = process.env.AI_API_BASE ?? 'https://api.openai.com/v1';
    const model = process.env.AI_API_MODEL ?? 'gpt-4o-mini';
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are the assistant inside a personal finance app. You receive the user\'s own aggregate spending figures (never their identity or credentials). Answer the question in at most four sentences. Clearly separate historical facts from estimates. Never guarantee returns or give investment advice.',
          },
          {
            role: 'user',
            content: `Aggregates (JSON): ${JSON.stringify(aggregates)}\n\nQuestion: ${question}`,
          },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) return ruleBased;
    const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) return ruleBased;
    return { source: 'llm', answer: text, figures: ruleBased.figures, disclaimer: DISCLAIMER_LLM };
  } catch {
    return ruleBased;
  }
}
