import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { csrfOf, del, patch, post, server, signedInAgent, startApi, stopApi } from './api.js';

beforeAll(startApi);
afterAll(stopApi);

const stamp = Date.now();
let a: ReturnType<typeof request.agent>;
let token: string;
let accountId = '';
let incomeCategoryId = '';
let expenseCategoryId = '';
let userCategoryId = '';
let transactionId = '';
let goalId = '';
let otherAccountId = ''; // a second user's account, for isolation checks
let otherUserToken: string;
let otherUserId = '';

beforeAll(async () => {
  a = await signedInAgent(`finance-${stamp}@example.com`);
  token = await csrfOf(a);

  const profile = await a.get('/api/v1/users/profile');
  otherUserId = profile.body.data.user.id;

  const income = await post(a, '/api/v1/categories', { name: `Salary ${stamp}`, type: 'INCOME' }, token);
  incomeCategoryId = income.body.data.category.id;
  const expense = await post(a, '/api/v1/categories', { name: `Groceries ${stamp}`, type: 'EXPENSE' }, token);
  expenseCategoryId = expense.body.data.category.id;

  const account = await post(a, '/api/v1/accounts', { name: 'Cash wallet', accountType: 'CASH', openingBalancePaise: 12050, currency: 'INR' }, token);
  accountId = account.body.data.account.id;

  // second user, second account — the isolation probe
  const b = await signedInAgent(`other-${stamp}@example.com`);
  otherUserToken = await csrfOf(b);
  const otherAccount = await post(b, '/api/v1/accounts', { name: 'Not yours', accountType: 'BANK' }, otherUserToken);
  otherAccountId = otherAccount.body.data.account.id;
});

describe('accounts v1', () => {
  it('creates an account and reports its computed balance', async () => {
    const list = await a.get('/api/v1/accounts');
    expect(list.status).toBe(200);
    const mine = list.body.data.accounts.find((x: { id: string }) => x.id === accountId);
    expect(mine.balancePaise).toBe('12050');
    expect(typeof mine.balancePaise).toBe('string'); // BigInt leaves as string
  });

  it('returns one account with its balance', async () => {
    const res = await a.get(`/api/v1/accounts/${accountId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.account.name).toBe('Cash wallet');
    expect(res.body.data.account.balancePaise).toBe('12050');
  });

  it('hides the other user’s account entirely (cross-user access)', async () => {
    console.log('PROBE otherAccountId:', otherAccountId.slice(0, 8), '| accountId:', accountId.slice(0, 8), '| typeof token:', typeof token);
    const probeList = await a.get('/api/v1/accounts');
    console.log('PROBE a-list:', JSON.stringify(probeList.body.data.accounts.map((x: { name: string }) => x.name)));
    const direct = await a.get(`/api/v1/accounts/${otherAccountId}`);
    console.log('PROBE direct:', direct.status, JSON.stringify(direct.body).slice(0, 160));
    expect(direct.status).toBe(404);
    const edit = await patch(a, `/api/v1/accounts/${otherAccountId}`, { name: 'stolen' }, token);
    expect(edit.status).toBe(404);
    const list = await a.get('/api/v1/accounts');
    expect(list.body.data.accounts.find((x: { id: string }) => x.id === otherAccountId)).toBeUndefined();
  });

  it('blocks deletion of accounts with history unless reassigned', async () => {
    const created = await post(a, '/api/v1/transactions', {
      accountId,
      categoryId: expenseCategoryId,
      type: 'EXPENSE',
      amountPaise: 4213,
      description: 'Metro Grocers',
      notes: 'weekly run',
      transactionDate: '2026-10-10',
    }, token);
    expect(created.status).toBe(201);
    expect(created.body.data.transaction.amountPaise).toBe('4213');
    transactionId = created.body.data.transaction.id;

    const blocked = await del(a, `/api/v1/accounts/${accountId}`, token);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('ACCOUNT_HAS_HISTORY');
  });
});

describe('transactions v1', () => {
  it('creates an income and rejects a transfer to the same account', async () => {
    const income = await post(a, '/api/v1/transactions', {
      accountId,
      categoryId: incomeCategoryId,
      type: 'INCOME',
      amountPaise: 100000,
      description: 'Payroll',
      transactionDate: '2026-10-01',
    }, token);
    expect(income.status).toBe(201);

    const badTransfer = await post(a, '/api/v1/transactions', {
      type: 'TRANSFER',
      accountId,
      transferAccountId: accountId,
      amountPaise: 100,
      transactionDate: '2026-10-02',
    }, token);
    expect(badTransfer.status).toBe(400);
  });

  it('creates a transfer that moves balance between accounts without touching totals', async () => {
    const second = await post(a, '/api/v1/accounts', { name: 'Bank', accountType: 'BANK' }, token);
    const bankId = second.body.data.account.id;

    const transfer = await post(a, '/api/v1/transactions', {
      type: 'TRANSFER',
      accountId,
      transferAccountId: bankId,
      amountPaise: 20000,
      description: 'Move to bank',
      transactionDate: '2026-10-05',
    }, token);
    expect(transfer.status).toBe(201);

    const accounts = await a.get('/api/v1/accounts');
    const cash = accounts.body.data.accounts.find((x: { id: string }) => x.id === accountId);
    const bank = accounts.body.data.accounts.find((x: { id: string }) => x.id === bankId);
    // 12050 − 4213 + 100000 − 20000 = 87837 (the income landed first)
    expect(cash.balancePaise).toBe('87837');
    expect(bank.balancePaise).toBe('20000');

    const summary = await a.get('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31');
    expect(summary.body.data.incomePaise).toBe('100000');
    expect(summary.body.data.expensePaise).toBe('4213');
  });

  it('lists with search, filters, sorting and pagination', async () => {
    await post(a, '/api/v1/transactions', {
      accountId,
      categoryId: expenseCategoryId,
      type: 'EXPENSE',
      amountPaise: 640,
      description: 'Blue Bottle',
      transactionDate: '2026-10-12',
    }, token);

    const all = await a.get('/api/v1/transactions?page=1&pageSize=2');
    expect(all.body.data.total).toBe(4);
    expect(all.body.data.items).toHaveLength(2);
    expect(new Date(all.body.data.items[0].transactionDate).getTime())
      .toBeGreaterThanOrEqual(new Date(all.body.data.items[1].transactionDate).getTime());

    const filtered = await a.get(`/api/v1/transactions?type=EXPENSE&categoryId=${expenseCategoryId}`);
    expect(filtered.body.data.total).toBe(2);

    const searched = await a.get('/api/v1/transactions?q=bottle');
    expect(searched.body.data.total).toBe(1);

    const paged = await a.get('/api/v1/transactions?page=2&pageSize=2');
    expect(paged.body.data.items).toHaveLength(2);

    const sorted = await a.get('/api/v1/transactions?sort=amount_desc&pageSize=1');
    expect(sorted.body.data.items[0].amountPaise).toBe('100000');
  });

  it('gets, updates and deletes one transaction', async () => {
    const one = await a.get(`/api/v1/transactions/${transactionId}`);
    expect(one.status).toBe(200);

    const updated = await patch(a, `/api/v1/transactions/${transactionId}`, { amountPaise: 5000, categoryId: expenseCategoryId }, token);
    expect(updated.body.data.transaction.amountPaise).toBe('5000');

    const removed = await del(a, `/api/v1/transactions/${transactionId}`, token);
    expect(removed.status).toBe(200);
    const gone = await a.get(`/api/v1/transactions/${transactionId}`);
    expect(gone.status).toBe(404);
  });

  it('exports CSV with headers and amounts in rupees', async () => {
    const csv = await a.get('/api/v1/transactions/export?type=INCOME');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\r\n')[0]).toContain('"Date"');
    expect(csv.text).toContain('1000.00');
  });

  it('rejects a transaction pointed at the other user’s account', async () => {
    const res = await post(a, '/api/v1/transactions', {
      accountId: otherAccountId,
      categoryId: expenseCategoryId,
      type: 'EXPENSE',
      amountPaise: 100,
      transactionDate: '2026-10-10',
    }, token);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });
});

describe('categories v1', () => {
  it('serves system categories plus the user’s own', async () => {
    const res = await a.get('/api/v1/categories');
    const names = res.body.data.categories.map((c: { name: string }) => c.name);
    expect(names.some((n: string) => n.startsWith('Salary '))).toBe(true);
  });

  it('creates, edits and refuses to delete a category in use', async () => {
    const created = await post(a, '/api/v1/categories', { name: `Gardening ${stamp}`, type: 'EXPENSE', icon: 'leaf', color: '#2f7a45' }, token);
    userCategoryId = created.body.data.category.id;
    expect(created.body.data.category.isSystem).toBe(false);

    const renamed = await patch(a, `/api/v1/categories/${userCategoryId}`, { name: `Garden ${stamp}` }, token);
    expect(renamed.status).toBe(200);

    const inUse = await del(a, `/api/v1/categories/${expenseCategoryId}`, token);
    expect(inUse.status).toBe(409);
    expect(inUse.body.error.code).toBe('CATEGORY_IN_USE');
  });

  it('protects system categories from edit and delete', async () => {
    const list = await a.get('/api/v1/categories');
    const system = list.body.data.categories.find((c: { isSystem: boolean }) => c.isSystem);
    expect(system).toBeDefined();

    const edited = await patch(a, `/api/v1/categories/${system.id}`, { name: 'hacked' }, token);
    expect(edited.status).toBe(403);
    expect(edited.body.error.code).toBe('SYSTEM_CATEGORY');

    const deleted = await del(a, `/api/v1/categories/${system.id}`, token);
    expect(deleted.status).toBe(403);
  });
});

describe('budgets v1', () => {
  it('creates a monthly budget and computes spent from real expenses', async () => {
    const created = await post(a, '/api/v1/budgets', { categoryId: expenseCategoryId, month: 10, year: 2026, limitPaise: 2000 }, token);
    expect(created.status).toBe(201);
    expect(created.body.data.budget.limitPaise).toBe('2000');

    const list = await a.get('/api/v1/budgets?month=10&year=2026');
    const budget = list.body.data.budgets[0];
    expect(budget.spentPaise).toBe('640');
    expect(budget.percent).toBe(32);

    const raised = await post(a, '/api/v1/budgets', { categoryId: expenseCategoryId, month: 10, year: 2026, limitPaise: 3000 }, token);
    expect(raised.body.data.budget.limitPaise).toBe('3000'); // upsert, not duplicate

    const edited = await patch(a, `/api/v1/budgets/${created.body.data.budget.id}`, { limitPaise: 2500 }, token);
    expect(edited.status).toBe(200);
  });

  it('validates the month range', async () => {
    const res = await post(a, '/api/v1/budgets', { categoryId: expenseCategoryId, month: 13, year: 2026, limitPaise: 100 }, token);
    expect(res.status).toBe(400);
  });
});

describe('goals v1', () => {
  it('creates a goal; saved amounts come from contributions only', async () => {
    const goal = await post(a, '/api/v1/goals', { title: 'Emergency fund', targetPaise: 50000, deadline: '2026-12-31' }, token);
    expect(goal.status).toBe(201);
    expect(goal.body.data.goal.savedPaise).toBe('0');
    goalId = goal.body.data.goal.id;

    const c1 = await post(a, `/api/v1/goals/${goalId}/contributions`, { amountPaise: 30000, notes: 'October', contributionDate: '2026-10-05' }, token);
    expect(c1.status).toBe(201);
    expect(c1.body.data.savedPaise).toBe('30000');

    await post(a, `/api/v1/goals/${goalId}/contributions`, { amountPaise: 20000 }, token);

    const goals = await a.get('/api/v1/goals');
    expect(goals.body.data.goals[0].savedPaise).toBe('50000');
    expect(goals.body.data.goals[0].status).toBe('ACHIEVED');

    const history = await a.get(`/api/v1/goals/${goalId}/contributions`);
    expect(history.body.data.contributions).toHaveLength(2);
  });

  it('isolates the other user’s goal', async () => {
    const otherGoal = await post(a, '/api/v1/goals', { title: 'Private pot', targetPaise: 1000 }, token);
    const b = request.agent(server.url);
    const bToken = await csrfOf(b);
    await post(b, '/api/v1/auth/login', { email: `other-${stamp}@example.com`, password: 'finance2026' }, bToken);
    const res = await post(b, `/api/v1/goals/${otherGoal.body.data.goal.id}/contributions`, { amountPaise: 5 }, await csrfOf(b));
    expect(res.status).toBe(404);
  });
});

describe('dashboard + reports v1', () => {
  it('composes the summary with balance, month sums and alerts', async () => {
    const res = await a.get('/api/v1/dashboard/summary?month=10&year=2026');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(typeof d.totalBalancePaise).toBe('string');
    expect(d.incomePaise).toBe('100000');
    expect(d.expensePaise).toBe('640');
    expect(d.netPaise).toBe('99360');
    expect(Array.isArray(d.alerts)).toBe(true);
  });

  it('serves trends, categories and recent transactions', async () => {
    const trends = await a.get('/api/v1/dashboard/trends?months=6');
    expect(trends.body.data.series).toHaveLength(6);

    const categories = await a.get('/api/v1/dashboard/categories?month=10&year=2026');
    expect(categories.body.data.categories[0].expensePaise).toBe('640');

    const recent = await a.get('/api/v1/dashboard/recent-transactions');
    expect(recent.body.data.transactions.length).toBeGreaterThan(0);
  });

  it('serves report summary, monthly series and categories', async () => {
    const summary = await a.get('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31');
    expect(summary.body.data.savingsRate).toBeCloseTo(99.4, 1);

    const monthly = await a.get('/api/v1/reports/monthly?months=12');
    expect(monthly.body.data.series).toHaveLength(12);

    const categories = await a.get('/api/v1/reports/categories?from=2026-10-01&to=2026-10-31');
    expect(categories.body.data.categories.length).toBeGreaterThan(0);
  });

  it('exports the range as CSV', async () => {
    const csv = await a.get('/api/v1/reports/export?from=2026-10-01&to=2026-10-31');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('1000.00');
  });
});
