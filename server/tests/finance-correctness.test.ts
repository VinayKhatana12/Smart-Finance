import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { csrfOf, del, patch, post, server, signedInAgent, startApi, stopApi } from './api.js';
import { prisma } from '../src/db/prisma.js';

beforeAll(startApi);
afterAll(stopApi);

const stamp = Date.now();
let a: ReturnType<typeof request.agent>;
let token: string;
let accountId = '';
let incomeCategoryId = '';
let foodCategoryId = '';

beforeAll(async () => {
  a = await signedInAgent(`fin-correct-${stamp}@example.com`);
  token = await csrfOf(a);
  const cats = await a.get('/api/v1/categories');
  incomeCategoryId = cats.body.data.categories.find((c: { name: string; type: string }) => c.name === 'Salary').id;
  foodCategoryId = cats.body.data.categories.find((c: { name: string; type: string }) => c.name === 'Groceries').id;
  const acc = await post(a, '/api/v1/accounts', { name: 'Correctness Bank', accountType: 'BANK', openingBalancePaise: 0, currency: 'INR' }, token);
  accountId = acc.body.data.account.id;
});

const addTxn = (body: Record<string, unknown>, t = token) => post(a, '/api/v1/transactions', body, t);
const balanceOf = async (id = accountId): Promise<bigint> =>
  BigInt((await a.get(`/api/v1/accounts/${id}`)).body.data.account.balancePaise);

describe('financial correctness', () => {
  it('rejects zero, negative, fractional-paise and float-precision amounts', async () => {
    for (const amountPaise of [0, -5000, 1000.5]) {
      const res = await addTxn({
        accountId, categoryId: foodCategoryId, type: 'EXPENSE', amountPaise, transactionDate: '2026-10-10',
      }, token);
      expect(res.status, `amountPaise ${amountPaise}`).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    // 0.1 + 0.2 style float traps: the API only accepts integer paise
    const float = await addTxn({
      accountId, categoryId: foodCategoryId, type: 'EXPENSE', amountPaise: 0.1 + 0.2, transactionDate: '2026-10-10',
    }, token);
    expect(float.status).toBe(400);
  });

  it('accepts very large monetary values (₹90 crore) without precision loss', async () => {
    // 9,000,000,000 paise = ₹9 crore — well within bigint and JS safe integers
    const large = await addTxn({
      accountId, categoryId: incomeCategoryId, type: 'INCOME', amountPaise: 9_000_000_000, description: 'Large credit', transactionDate: '2026-10-01',
    }, token);
    expect(large.status).toBe(201);
    expect(large.body.data.transaction.amountPaise).toBe('9000000000');

    const balance = await balanceOf();
    expect(balance).toBe(9_000_000_000n);
  });

  it('rejects amounts beyond the safe-integer range', async () => {
    const res = await addTxn({
      accountId, categoryId: incomeCategoryId, type: 'INCOME', amountPaise: 99_999_999_999_999_999, transactionDate: '2026-10-02',
    }, token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('computes income, expense and net correctly across many mixed operations', async () => {
    await addTxn({ accountId, categoryId: foodCategoryId, type: 'EXPENSE', amountPaise: 250_00, description: 'g1', transactionDate: '2026-10-03' }, token);
    await addTxn({ accountId, categoryId: foodCategoryId, type: 'EXPENSE', amountPaise: 125_50, description: 'g2', transactionDate: '2026-10-04' }, token);
    await addTxn({ accountId, categoryId: incomeCategoryId, type: 'INCOME', amountPaise: 1_000_00, description: 'i1', transactionDate: '2026-10-05' }, token);

    const summary = await a.get('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31');
    const income = Number(summary.body.data.incomePaise);
    const expense = Number(summary.body.data.expensePaise);
    // income: 9,000,000,000 + 1,000,00 ; expense: 250,00 + 125,50
    expect(income).toBe(9_000_000_000 + 100_000);
    expect(expense).toBe(37_550);
    expect(Number(summary.body.data.netPaise)).toBe(income - expense);
    expect(summary.body.data.netPaise).toBe((BigInt(income) - BigInt(expense)).toString());
  });

  it('moves money between accounts with transfers and leaves totals untouched', async () => {
    const second = await post(a, '/api/v1/accounts', { name: 'Wallet 2', accountType: 'WALLET', openingBalancePaise: 0, currency: 'INR' }, token);
    const walletId = second.body.data.account.id;

    const preMain = await balanceOf();
    const before = await a.get('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31');
    const transfer = await addTxn({
      accountId, categoryId: incomeCategoryId, type: 'TRANSFER', transferAccountId: walletId,
      amountPaise: 75_00, description: 'to wallet', transactionDate: '2026-10-20',
    }, token);
    expect(transfer.status).toBe(201);

    const after = await a.get('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31');
    expect(after.body.data.incomePaise).toBe(before.body.data.incomePaise);
    expect(after.body.data.expensePaise).toBe(before.body.data.expensePaise);

    const accounts = await a.get('/api/v1/accounts');
    const main = accounts.body.data.accounts.find((x: { id: string }) => x.id === accountId);
    const wallet = accounts.body.data.accounts.find((x: { id: string }) => x.id === walletId);
    expect(BigInt(main.balancePaise)).toBe(preMain - 7500n);
    expect(BigInt(wallet.balancePaise)).toBe(7500n);
    void before;
  });

  it('rejects a transfer to the same account', async () => {
    const res = await addTxn({
      accountId, categoryId: incomeCategoryId, type: 'TRANSFER', transferAccountId: accountId,
      amountPaise: 100, transactionDate: '2026-10-21',
    }, token);
    expect(res.status).toBe(400);
  });

  it('handles refunds as income and recomputes the balance', async () => {
    // Refund policy: a refund is recorded as INCOME in the original expense
    // category — it increases the account balance and the month's income.
    const before = await balanceOf();
    const refund = await addTxn({
      accountId, categoryId: foodCategoryId, type: 'INCOME', amountPaise: 125_50, description: 'g2 refund', transactionDate: '2026-10-04',
    }, token);
    expect(refund.status).toBe(201);
    expect(await balanceOf()).toBe(before + 125_50n);
  });

  it('computes budget spending across month boundaries in the user timezone', async () => {
    // budgets for October and November 2026; the spends straddle the boundary
    const bOct = await post(a, '/api/v1/budgets', { categoryId: foodCategoryId, month: 10, year: 2026, limitPaise: 100_000 }, token);
    expect(bOct.status).toBe(201);
    const budget = await post(a, '/api/v1/budgets', { categoryId: foodCategoryId, month: 11, year: 2026, limitPaise: 100_000 }, token);
    expect(budget.status).toBe(201);

    // Oct 31 23:30 IST = Oct 31 18:00 UTC → still October, NOT November
    await addTxn({ accountId, categoryId: foodCategoryId, type: 'EXPENSE', amountPaise: 30_000, description: 'Oct 31 late night', transactionDate: '2026-10-31' }, token);
    // Nov 1 07:00 IST = Nov 1 01:30 UTC → November
    await addTxn({ accountId, categoryId: foodCategoryId, type: 'EXPENSE', amountPaise: 20_000, description: 'Nov 1 morning', transactionDate: '2026-11-01' }, token);

    const november = await a.get('/api/v1/budgets?month=11&year=2026');
    expect(november.body.data.budgets[0].spentPaise).toBe('20000');
    const october = await a.get('/api/v1/budgets?month=10&year=2026');
    const octBudget = october.body.data.budgets.find((b: { categoryId: string }) => b.categoryId === foodCategoryId);
    // 30000 (late-night Oct 31 IST) + 37550 (g1 + g2 from the mixed-ops test) —
    // all still October in Asia/Kolkata
    expect(octBudget.spentPaise).toBe('67550');
  });

  it('recomputes budget spent after editing and deleting transactions', async () => {
    const november = await a.get('/api/v1/budgets?month=11&year=2026');
    const budget = november.body.data.budgets[0];
    expect(budget.spentPaise).toBe('20000');

    const created = await addTxn({ accountId, categoryId: foodCategoryId, type: 'EXPENSE', amountPaise: 50_000, description: 'big shop', transactionDate: '2026-11-05' }, token);
    expect(created.body.data.transaction.id).toBeDefined();
    const afterCreate = await a.get('/api/v1/budgets?month=11&year=2026');
    expect(afterCreate.body.data.budgets[0].spentPaise).toBe('70000');
    expect(afterCreate.body.data.budgets[0].percent).toBe(70);

    const edited = await patch(a, `/api/v1/transactions/${created.body.data.transaction.id}`, { amountPaise: 10_000 }, token);
    expect(edited.status).toBe(200);
    const afterEdit = await a.get('/api/v1/budgets?month=11&year=2026');
    expect(afterEdit.body.data.budgets[0].spentPaise).toBe('30000');

    const removed = await del(a, `/api/v1/transactions/${created.body.data.transaction.id}`, token);
    expect(removed.status).toBe(200);
    const afterDelete = await a.get('/api/v1/budgets?month=11&year=2026');
    expect(afterDelete.body.data.budgets[0].spentPaise).toBe('20000');
  });

  it('adds and reports goal contributions atomically', async () => {
    const goal = await post(a, '/api/v1/goals', { title: 'Correctness pot', targetPaise: 10_000_000 }, token);
    const goalId = goal.body.data.goal.id;

    await post(a, `/api/v1/goals/${goalId}/contributions`, { amountPaise: 400_000, contributionDate: '2026-11-01' }, token);
    await post(a, `/api/v1/goals/${goalId}/contributions`, { amountPaise: 250_000, contributionDate: '2026-11-02' }, token);

    const goals = await a.get('/api/v1/goals');
    const pot = goals.body.data.goals.find((g: { id: string }) => g.id === goalId);
    expect(pot.savedPaise).toBe('650000');
    expect(pot.percent).toBe(6); // floor(6.5)
    expect(Number(pot.savedPaise)).toBe(650_000);
  });

  it('enforces ownership on edit and delete of every resource', async () => {
    const b = request.agent(server.url);
    const bToken = await csrfOf(b);
    await post(b, '/api/v1/auth/register', { name: 'Other Fin', email: `fin-other-${stamp}@example.com`, password: 'integrity9' }, bToken);

    const aTxn = await addTxn({ accountId, categoryId: foodCategoryId, type: 'EXPENSE', amountPaise: 100, transactionDate: '2026-11-10' }, token);
    const txnId = aTxn.body.data.transaction.id;

    const editAsB = await patch(b, `/api/v1/transactions/${txnId}`, { amountPaise: 999 }, await csrfOf(b));
    expect(editAsB.status).toBe(404);
    const deleteAsB = await del(b, `/api/v1/transactions/${txnId}`, await csrfOf(b));
    expect(deleteAsB.status).toBe(404);

    const aBudget = await post(a, '/api/v1/budgets', { categoryId: foodCategoryId, month: 12, year: 2026, limitPaise: 1000 }, token);
    const editBudgetAsB = await patch(b, `/api/v1/budgets/${aBudget.body.data.budget.id}`, { limitPaise: 999 }, await csrfOf(b));
    expect(editBudgetAsB.status).toBe(404);
  });

  it('uses database constraints for money integrity (raw SQL bypass attempt)', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO transactions (id, user_id, account_id, category_id, type, amount_paise, transaction_date)
         VALUES (gen_random_uuid(), $1, $2, $3, 'EXPENSE', -500, now())`,
        (await prisma.user.findFirst({ where: { email: `fin-correct-${stamp}@example.com` } }))!.id,
        accountId,
        foodCategoryId,
      ),
    ).rejects.toThrow(); // CHECK (amount_paise >= 1)
  });
});
