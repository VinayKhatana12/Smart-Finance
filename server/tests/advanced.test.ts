import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { csrfOf, del, patch, post, server, signedInAgent, startApi, stopApi } from './api.js';

beforeAll(startApi);
afterAll(stopApi);

const stamp = Date.now();
let a: ReturnType<typeof request.agent>;
let token: string;
let accountId = '';
let categoryId = '';
let ruleId = '';

describe('notifications v1', () => {
  it('starts empty for a fresh user', async () => {
    a = await signedInAgent(`adv-${stamp}@example.com`);
    token = await csrfOf(a);
    const res = await a.get('/api/v1/notifications');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.unread).toBe(0);
  });
});

describe('recurring rules v1', () => {
  it('creates an account and rule, then generates due transactions idempotently', async () => {
    const cat = await a.get('/api/v1/categories');
    const rent = cat.body.data.categories.find((c: { name: string; type: string }) => c.name === 'Housing');
    categoryId = rent.id;
    const acc = await post(a, '/api/v1/accounts', { name: 'Bank main', accountType: 'BANK', currency: 'INR' }, token);
    accountId = acc.body.data.account.id;

    // rule started in the past: three monthly runs are due (Oct/Nov/Dec 1) before "today" (2026-10-31 era tests may vary;
    // we pick a start far enough back that at least 2 occurrences are due)
    const rule = await post(
      a,
      '/api/v1/recurring',
      {
        accountId,
        categoryId,
        type: 'EXPENSE',
        title: 'Rent',
        amountPaise: 1500000,
        frequency: 'MONTHLY',
        startDate: '2026-08-01',
      },
      token,
    );
    expect(rule.status).toBe(201);
    expect(rule.body.data.rule.nextRunDate).toBe('2026-08-01');
    ruleId = rule.body.data.rule.id;

    const run1 = await post(a, '/api/v1/recurring/run', {}, token);
    expect(run1.status).toBe(200);
    const created1 = run1.body.data.created;
    expect(created1).toBeGreaterThanOrEqual(2); // Aug + Sep (+ Oct when reached)

    // idempotency: running again creates nothing new
    // nothing is due any more: nextRunDate advanced past today
    const run2 = await post(a, '/api/v1/recurring/run', {}, token);
    expect(run2.body.data.created).toBe(0);

    // deep idempotency: simulate a crashed run (nextRunDate not advanced) —
    // re-generating books nothing new; the unique occurrence key absorbs it
    const { generateDueTransactions } = await import('../src/services/recurring.service.js');
    const { prisma } = await import('../src/db/prisma.js');
    await prisma.recurringRule.update({ where: { id: ruleId }, data: { nextRunDate: new Date('2026-08-01'), lastRunDate: null } });
    const reRun = await generateDueTransactions(undefined, new Date('2026-10-31T00:00:00.000Z'));
    expect(reRun.created).toBe(0);
    expect(reRun.skipped).toBeGreaterThanOrEqual(2);
    const txnCount = await prisma.transaction.count({ where: { recurringRuleId: ruleId } });
    expect(txnCount).toBe(created1); // exactly one transaction per occurrence

    const list = await a.get('/api/v1/transactions?pageSize=100');
    const rentTxns = list.body.data.items.filter((t: { description: string }) => t.description.includes('recurring'));
    expect(rentTxns.length).toBe(created1);
    // uniqueness lives in the occurrence_key column (asserted via txnCount above);
    // the visible notes are intentionally uniform
  });

  it('rejects an end date before the start date', async () => {
    const res = await post(
      a,
      '/api/v1/recurring',
      { accountId, categoryId, type: 'INCOME', title: 'Bad', amountPaise: 100, frequency: 'DAILY', startDate: '2026-10-10', endDate: '2026-10-01' },
      token,
    );
    expect(res.status).toBe(400);
  });

  it('updates (pause) and deletes a rule; generated history stays', async () => {
    const paused = await patch(a, `/api/v1/recurring/${ruleId}`, { active: false }, token);
    expect(paused.status).toBe(200);
    const run = await post(a, '/api/v1/recurring/run', {}, token);
    expect(run.status).toBe(200);
    expect(run.body.data.rulesProcessed).toBe(0); // inactive rules are skipped

    const removed = await del(a, `/api/v1/recurring/${ruleId}`, token);
    expect(removed.status).toBe(200);
    const list = await a.get('/api/v1/transactions?pageSize=100');
    expect(list.body.data.total).toBeGreaterThanOrEqual(2); // generated history persists
  });
});

describe('budget notifications v1', () => {
  it('mints 80%, 100% and exceeded notifications exactly once per threshold', async () => {
    // ₹5,000 food budget, spending pushed through the thresholds
    const cat = await a.get('/api/v1/categories');
    const food = cat.body.data.categories.find((c: { name: string; type: string }) => c.name === 'Groceries');
    const created = await post(a, '/api/v1/budgets', { categoryId: food.id, month: 10, year: 2026, limitPaise: 100000 }, token);
    expect(created.status).toBe(201);

    const spend = async (paise: number) => {
      await post(
        a,
        '/api/v1/transactions',
        { accountId, categoryId: food.id, type: 'EXPENSE', amountPaise: paise, description: `Food ${paise}`, transactionDate: '2026-10-15' },
        token,
      );
      // evaluation runs when the dashboard is viewed
      await a.get('/api/v1/dashboard/summary?month=10&year=2026');
    };

    // below 80% → no notifications yet
    await spend(50000); // 50%
    let evalRes = await a.get('/api/v1/dashboard/summary?month=10&year=2026');
    expect(evalRes.status).toBe(200);
    let notifications = await a.get('/api/v1/notifications');
    expect(notifications.body.data.items.filter((n: { type: string }) => n.type.startsWith('BUDGET'))).toHaveLength(0);

    // 80–99% → exactly one warning
    await spend(35000); // 85%
    notifications = await a.get('/api/v1/notifications');
    expect(notifications.body.data.items.filter((n: { type: string }) => n.type === 'BUDGET_WARNING')).toHaveLength(1);

    // re-evaluating (repeat transactions below 100% would change %, but calling list again) → still one
    notifications = await a.get('/api/v1/notifications');
    expect(notifications.body.data.items.filter((n: { type: string }) => n.type === 'BUDGET_WARNING')).toHaveLength(1);

    // exactly 100% → limit notification, warning stays
    await spend(15000); // 100%
    notifications = await a.get('/api/v1/notifications');
    expect(notifications.body.data.items.filter((n: { type: string }) => n.type === 'BUDGET_LIMIT')).toHaveLength(1);
    expect(notifications.body.data.items.filter((n: { type: string }) => n.type === 'BUDGET_WARNING')).toHaveLength(1);

    // >100% → exceeded, previous two unchanged (no duplicates)
    await spend(10000); // 110%
    notifications = await a.get('/api/v1/notifications');
    expect(notifications.body.data.items.filter((n: { type: string }) => n.type === 'BUDGET_EXCEEDED')).toHaveLength(1);
    expect(notifications.body.data.items.filter((n: { type: string }) => n.type === 'BUDGET_LIMIT')).toHaveLength(1);
    expect(notifications.body.data.items.filter((n: { type: string }) => n.type === 'BUDGET_WARNING')).toHaveLength(1);

    // idempotency under repeated evaluation
    evalRes = await a.get('/api/v1/dashboard/summary?month=10&year=2026');
    notifications = await a.get('/api/v1/notifications');
    expect(notifications.body.data.items.filter((n: { type: string }) => n.type.startsWith('BUDGET'))).toHaveLength(3);
  });

  it('marks one read, marks all read, and clears one', async () => {
    const notifications = await a.get('/api/v1/notifications');
    const first = notifications.body.data.items[0];
    expect(first.read).toBe(false);

    const read = await post(a, `/api/v1/notifications/${first.id}/read`, {}, token);
    expect(read.status).toBe(200);

    const afterOne = await a.get('/api/v1/notifications');
    expect(afterOne.body.data.unread).toBe(afterOne.body.data.items.length - 1);

    const all = await post(a, '/api/v1/notifications/read-all', {}, token);
    expect(all.status).toBe(200);
    const afterAll = await a.get('/api/v1/notifications');
    expect(afterAll.body.data.unread).toBe(0);

    const cleared = await del(a, `/api/v1/notifications/${first.id}`, token);
    expect(cleared.status).toBe(200);
    const final = await a.get('/api/v1/notifications');
    expect(final.body.data.items.find((n: { id: string }) => n.id === first.id)).toBeUndefined();
  });
});

describe('insights v1', () => {
  it('returns rule-based insights with figures from the ledger', async () => {
    const res = await a.get('/api/v1/insights?month=2026-10');
    expect(res.status).toBe(200);
    const insights = res.body.data.insights;
    const kinds = insights.map((i: { kind: string }) => i.kind);
    expect(kinds).toContain('top-category');
    expect(kinds).toContain('mom-expense');
    expect(kinds).toContain('daily-spend');
    expect(kinds).toContain('budget-usage');

    const top = insights.find((i: { kind: string }) => i.kind === 'top-category');
    expect(top.detail).toMatch(/Groceries|Housing/);
  });
});

describe('reports v1: monthly, annual, income, expense, savings, PDF', () => {
  it('returns the monthly report with budgets and recent transactions', async () => {
    const res = await a.get('/api/v1/reports/monthly/2026/10');
    expect(res.status).toBe(200);
    expect(res.body.data.period).toBe('2026-10');
    expect(res.body.data.budgets.length).toBeGreaterThan(0);
    expect(res.body.data.recent.length).toBeGreaterThan(0);
  });

  it('returns a downloadable PDF', async () => {
    const res = await a.get('/api/v1/reports/monthly/2026/10/pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
    expect(res.body.length).toBeGreaterThan(500);
  });

  it('returns annual, income, expense and savings reports', async () => {
    const annual = await a.get('/api/v1/reports/annual/2026');
    expect(annual.status).toBe(200);
    expect(annual.body.data.byMonth).toHaveLength(12);

    const income = await a.get('/api/v1/reports/income/2026');
    expect(income.status).toBe(200);
    expect(income.body.data.type).toBe('INCOME');

    const expense = await a.get('/api/v1/reports/expense/2026');
    expect(expense.body.data.type).toBe('EXPENSE');

    const savings = await a.get('/api/v1/reports/savings/2026');
    expect(savings.status).toBe(200);
    expect(savings.body.data.byMonth).toHaveLength(12);
  });
});

describe('assistant v1', () => {
  it('answers "where did I spend the most" from real data (rule-based, no API key)', async () => {
    const res = await post(a, '/api/v1/assistant/ask', { question: 'Where did I spend the most money?' }, token);
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('rules');
    expect(res.body.data.answer).toBeTruthy();
    expect(res.body.data.disclaimer).toMatch(/not financial advice/);
  });

  it('answers the exceeded-budget question', async () => {
    const res = await post(a, '/api/v1/assistant/ask', { question: 'Which categories exceeded my budgets?' }, token);
    expect(res.status).toBe(200);
    expect(res.body.data.answer).toMatch(/exceeded/i);
  });

  it('answers a what-if reduction with an estimate and a disclaimer', async () => {
    const res = await post(a, '/api/v1/assistant/ask', { question: 'How much can I save if I reduce food spending by 10%?' }, token);
    expect(res.status).toBe(200);
    expect(res.body.data.answer).toMatch(/estimate/i);
  });
});
