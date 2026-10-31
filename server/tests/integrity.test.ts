import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { startApi, stopApi, server } from './api.js';

/**
 * The full data-integrity scenario from the integration spec, executed against
 * a real PostgreSQL with isolated per-run data. Paise: ₹1 = 100 paise.
 */
const PAISE = (rupees: number): number => Math.round(rupees * 100);

beforeAll(startApi);
afterAll(stopApi);

let a: ReturnType<typeof request.agent>;
let token: string;
let accountId = '';
let secondAccountId = '';
let incomeCategoryId = '';
let foodCategoryId = '';
let expenseId = '';
let goalId = '';
let budgetId = '';

async function csrf(agent: ReturnType<typeof request.agent>): Promise<string> {
  return (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken as string;
}

const post = (agent: ReturnType<typeof request.agent>, url: string, body: unknown, t: string) =>
  agent.post(url).set('X-CSRF-Token', t).send(body);
const patch = (agent: ReturnType<typeof request.agent>, url: string, body: unknown, t: string) =>
  agent.patch(url).set('X-CSRF-Token', t).send(body);
const del = (agent: ReturnType<typeof request.agent>, url: string, t: string) =>
  agent.delete(url).set('X-CSRF-Token', t);

describe('data integrity scenario (isolated test data)', () => {
  // steps 1–2: register + bank account
  it('registers a user and creates a bank account', async () => {
    a = request.agent(server.url);
    token = await csrf(a);
    const reg = await post(
      a,
      '/api/v1/auth/register',
      { name: 'Integrity Tester', email: `integrity-${Date.now()}@example.com`, password: 'integrity9', currency: 'INR', timezone: 'Asia/Kolkata' },
      token,
    );
    expect(reg.status).toBe(201);

    const cat = await a.get('/api/v1/categories');
    const salary = cat.body.data.categories.find((c: { name: string; type: string }) => c.name === 'Salary');
    const food = cat.body.data.categories.find((c: { name: string; type: string }) => c.name === 'Groceries');
    incomeCategoryId = salary.id;
    foodCategoryId = food.id;

    const acc = await post(
      a,
      '/api/v1/accounts',
      { name: 'HDFC Savings', accountType: 'BANK', openingBalancePaise: 0, currency: 'INR' },
      token,
    );
    expect(acc.status).toBe(201);
    accountId = acc.body.data.account.id;
    expect(acc.body.data.account.balancePaise).toBe('0');
  });

  // steps 3–5: income + expense + balance
  it('adds ₹10,000 income and a ₹2,000 food expense; balance becomes ₹8,000', async () => {
    const income = await post(
      a,
      '/api/v1/transactions',
      { accountId, categoryId: incomeCategoryId, type: 'INCOME', amountPaise: PAISE(10000), description: 'October salary', transactionDate: '2026-10-01' },
      token,
    );
    expect(income.status).toBe(201);

    const expense = await post(
      a,
      '/api/v1/transactions',
      { accountId, categoryId: foodCategoryId, type: 'EXPENSE', amountPaise: PAISE(2000), description: 'Food run', transactionDate: '2026-10-05' },
      token,
    );
    expect(expense.status).toBe(201);
    expenseId = expense.body.data.transaction.id;

    const acc = await a.get(`/api/v1/accounts/${accountId}`);
    expect(acc.body.data.account.balancePaise).toBe(String(PAISE(8000)));
  });

  // step 6: net cash flow
  it('reports net cash flow of ₹8,000 for the month', async () => {
    const res = await a.get('/api/v1/dashboard/summary?month=10&year=2026');
    expect(res.status).toBe(200);
    expect(res.body.data.incomePaise).toBe(String(PAISE(10000)));
    expect(res.body.data.expensePaise).toBe(String(PAISE(2000)));
    expect(res.body.data.netPaise).toBe(String(PAISE(8000)));
    expect(res.body.data.savingsRate).toBe(80);
  });

  // steps 7–8: budget + 40% utilization
  it('creates a ₹5,000 food budget and reads 40% utilization', async () => {
    const created = await post(a, '/api/v1/budgets', { categoryId: foodCategoryId, month: 10, year: 2026, limitPaise: PAISE(5000) }, token);
    expect(created.status).toBe(201);
    budgetId = created.body.data.budget.id;

    const list = await a.get('/api/v1/budgets?month=10&year=2026');
    const budget = list.body.data.budgets[0];
    expect(budget.limitPaise).toBe(String(PAISE(5000)));
    expect(budget.spentPaise).toBe(String(PAISE(2000)));
    expect(budget.remainingPaise).toBe(String(PAISE(3000)));
    expect(budget.percent).toBe(40);
  });

  // steps 9–11: goal + contribution + saved amount
  it('creates a ₹20,000 goal, contributes ₹1,000, saved becomes ₹1,000', async () => {
    const goal = await post(a, '/api/v1/goals', { title: 'Emergency fund', targetPaise: PAISE(20000), deadline: '2027-03-31' }, token);
    expect(goal.status).toBe(201);
    goalId = goal.body.data.goal.id;
    expect(goal.body.data.goal.savedPaise).toBe('0');

    const contribution = await post(a, `/api/v1/goals/${goalId}/contributions`, { amountPaise: PAISE(1000), notes: 'first' }, token);
    expect(contribution.status).toBe(201);
    expect(contribution.body.data.savedPaise).toBe(String(PAISE(1000)));

    const goals = await a.get('/api/v1/goals');
    expect(goals.body.data.goals[0].savedPaise).toBe(String(PAISE(1000)));
    expect(goals.body.data.goals[0].percent).toBe(5);
    expect(goals.body.data.goals[0].remainingPaise).toBe(String(PAISE(19000)));
  });

  // step 12: edit the expense → dashboard totals update
  it('edits the expense to ₹2,500 and the dashboard recomputes (net ₹7,500, budget 50%)', async () => {
    const edited = await patch(a, `/api/v1/transactions/${expenseId}`, { amountPaise: PAISE(2500) }, token);
    expect(edited.status).toBe(200);
    expect(edited.body.data.transaction.amountPaise).toBe(String(PAISE(2500)));

    const summary = await a.get('/api/v1/dashboard/summary?month=10&year=2026');
    expect(summary.body.data.expensePaise).toBe(String(PAISE(2500)));
    expect(summary.body.data.netPaise).toBe(String(PAISE(7500)));

    const acc = await a.get(`/api/v1/accounts/${accountId}`);
    expect(acc.body.data.account.balancePaise).toBe(String(PAISE(7500)));

    const budgets = await a.get('/api/v1/budgets?month=10&year=2026');
    expect(budgets.body.data.budgets[0].percent).toBe(50);
  });

  // step 13: delete a transaction → balance updates
  it('deletes the expense and the balance returns to ₹10,000', async () => {
    const removed = await del(a, `/api/v1/transactions/${expenseId}`, token);
    expect(removed.status).toBe(200);

    const acc = await a.get(`/api/v1/accounts/${accountId}`);
    expect(acc.body.data.account.balancePaise).toBe(String(PAISE(10000)));

    const summary = await a.get('/api/v1/dashboard/summary?month=10&year=2026');
    expect(summary.body.data.expensePaise).toBe('0');
    expect(summary.body.data.netPaise).toBe(String(PAISE(10000)));
  });

  // offline-replay idempotency: submitting the same clientRequestId twice
  // yields ONE transaction — the second response returns the original (200)
  it('de-duplicates a retried offline submission by clientRequestId', async () => {
    const clientRequestId = crypto.randomUUID();
    const payload = {
      accountId,
      categoryId: foodCategoryId,
      type: 'EXPENSE',
      amountPaise: PAISE(1000),
      description: 'Queued offline',
      transactionDate: '2026-10-07',
      clientRequestId,
    };
    const first = await post(a, '/api/v1/transactions', payload, token);
    expect(first.status).toBe(201);
    expect(first.body.data.duplicate).toBe(false);

    const replay = await post(a, '/api/v1/transactions', payload, token);
    expect(replay.status).toBe(200);
    expect(replay.body.data.duplicate).toBe(true);
    expect(replay.body.data.transaction.id).toBe(first.body.data.transaction.id);

    const list = await a.get('/api/v1/transactions?pageSize=100');
    expect(list.body.data.items.filter((t: { description: string }) => t.description === 'Queued offline')).toHaveLength(1);
  });

  // re-add the expense for the transfer test, then check transfers
  it('moves ₹3,000 between accounts without touching income or expense totals', async () => {
    const second = await post(a, '/api/v1/accounts', { name: 'Wallet', accountType: 'WALLET' }, token);
    secondAccountId = second.body.data.account.id;

    await post(
      a,
      '/api/v1/transactions',
      { accountId, categoryId: foodCategoryId, type: 'EXPENSE', amountPaise: PAISE(2000), description: 'Food run', transactionDate: '2026-10-05' },
      token,
    );

    const before = await a.get('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31');
    const incomeBefore = before.body.data.incomePaise;
    const expenseBefore = before.body.data.expensePaise;
    const preTransferBank = BigInt(
      (await a.get(`/api/v1/accounts/${accountId}`)).body.data.account.balancePaise,
    );

    const transfer = await post(
      a,
      '/api/v1/transactions',
      { type: 'TRANSFER', accountId, transferAccountId: secondAccountId, amountPaise: PAISE(3000), description: 'To wallet', transactionDate: '2026-10-20' },
      token,
    );
    expect(transfer.status).toBe(201);

    const after = await a.get('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31');
    expect(after.body.data.incomePaise).toBe(incomeBefore);
    expect(after.body.data.expensePaise).toBe(expenseBefore);

    const accounts = await a.get('/api/v1/accounts');
    const bank = accounts.body.data.accounts.find((x: { id: string }) => x.id === accountId);
    const wallet = accounts.body.data.accounts.find((x: { id: string }) => x.id === secondAccountId);
    // the transfer moves exactly ₹3,000: bank down 3,000, wallet up 3,000 —
    // relative to the pre-transfer state (other tests may add their own rows)
    expect(BigInt(bank.balancePaise)).toBe(preTransferBank - BigInt(PAISE(3000)));
    expect(wallet.balancePaise).toBe(String(PAISE(3000)));

    budgetId = budgetId; // budget already verified above
  });

  // steps 14–15: session persistence + logout
  it('persists the session across a "page reload" (new agent, same cookies are the browser’s)', async () => {
    // the agent's cookie jar IS the browser's cookie store; a fresh request with
    // the same jar simulates reopening the page
    const me = await a.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toContain('integrity-');
  });

  it('logs out and leaves protected pages inaccessible', async () => {
    const logout = await del(a, '/api/v1/auth/logout', token).catch(() => null);
    // logout is a POST
    const res = await post(a, '/api/v1/auth/logout', {}, token);
    expect(res.status).toBe(200);

    const cookies = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookies).toMatch(/sf_at=;/); // cleared

    // even with the cleared jar the server refuses: the refresh token is revoked
    const refresh = await a.post('/api/v1/auth/refresh').set('X-CSRF-Token', await csrf(a));
    expect([401, 403]).toContain(refresh.status);
    void logout;
  });

  it('isolates a second user completely', async () => {
    const b = request.agent(server!.url);
    const bToken = await csrf(b);
    await post(b, '/api/v1/auth/register', { name: 'Other User', email: `other-${Date.now()}@example.com`, password: 'integrity9' }, bToken);

    const list = await b.get('/api/v1/accounts');
    expect(list.body.data.accounts).toHaveLength(0); // sees none of user A's accounts

    const goals = await b.get('/api/v1/goals');
    expect(goals.body.data.goals).toHaveLength(0); // none of A's goals

    const txns = await b.get('/api/v1/transactions');
    expect(txns.body.data.total).toBe(0);

    const budgets = await b.get('/api/v1/budgets?month=10&year=2026');
    expect(budgets.body.data.budgets).toHaveLength(0);
  });
});
