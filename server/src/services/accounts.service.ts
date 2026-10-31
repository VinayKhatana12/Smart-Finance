import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { CreateAccountInput, UpdateAccountInput } from '../validation/v1.schema.js';

export interface AccountWithBalance {
  id: string;
  name: string;
  accountType: string;
  openingBalancePaise: string;
  currency: string;
  balancePaise: string;
  createdAt: string;
}

/**
 * Balance = opening balance + Σ(income into the account) − Σ(expense out)
 * + Σ(transfer legs in) − Σ(transfer legs out). Always derived from the ledger
 * in one aggregate — bigint arithmetic in the database, never floats.
 */
export async function listAccounts(userId: string): Promise<AccountWithBalance[]> {
  const rows = await prisma.$queryRaw<{ id: string; name: string; account_type: string; opening_balance_paise: bigint; currency: string; created_at: Date; flow: bigint }[]>`
    SELECT a.id, a.name, a.account_type, a.opening_balance_paise, a.currency, a.created_at,
      COALESCE(SUM(
        CASE
          WHEN t.type = 'INCOME' THEN t.amount_paise
          WHEN t.type = 'EXPENSE' THEN -t.amount_paise
          WHEN t.type = 'TRANSFER' AND t.account_id = a.id THEN -t.amount_paise
          WHEN t.type = 'TRANSFER' AND t.transfer_account_id = a.id THEN t.amount_paise
          ELSE 0
        END
      ), 0::bigint) AS flow
    FROM accounts a
    LEFT JOIN transactions t
      ON t.account_id = a.id OR t.transfer_account_id = a.id
    WHERE a.user_id = ${userId}::uuid
    GROUP BY a.id
    ORDER BY a.created_at ASC
  `;
  return rows.map((row) => {
    // the pg adapter delivers int8 columns as strings — normalise to bigint
    const opening = BigInt(row.opening_balance_paise);
    const flow = BigInt(row.flow);
    return {
      id: row.id,
      name: row.name,
      accountType: row.account_type,
      openingBalancePaise: opening.toString(),
      currency: row.currency,
      balancePaise: (opening + flow).toString(),
      createdAt: row.created_at.toISOString(),
    };
  });
}

export async function getAccountWithBalance(userId: string, id: string): Promise<AccountWithBalance> {
  const all = await listAccounts(userId);
  const account = all.find((a) => a.id === id);
  if (!account) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'That account does not exist.');
  return account;
}

export async function assertOwnedAccount(userId: string, accountId: string): Promise<void> {
  const row = await prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true } });
  if (!row) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Pick one of your own accounts.');
}

export async function createAccount(userId: string, input: CreateAccountInput): Promise<AccountWithBalance> {
  const row = await prisma.account.create({
    data: {
      userId,
      name: input.name,
      accountType: input.accountType,
      openingBalancePaise: BigInt(input.openingBalancePaise),
      currency: input.currency,
    },
  });
  return {
    id: row.id,
    name: row.name,
    accountType: row.accountType,
    openingBalancePaise: row.openingBalancePaise.toString(),
    currency: row.currency,
    balancePaise: row.openingBalancePaise.toString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function updateAccount(userId: string, id: string, input: UpdateAccountInput): Promise<void> {
  const result = await prisma.account.updateMany({
    where: { id, userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.accountType !== undefined ? { accountType: input.accountType } : {}),
      ...(input.openingBalancePaise !== undefined ? { openingBalancePaise: BigInt(input.openingBalancePaise) } : {}),
    },
  });
  if (result.count === 0) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'That account does not exist.');
}

/**
 * Deletion policy: an account with history cannot be deleted outright — its
 * rows are the ledger. The caller either moves the history to another account
 * (`?reassignTo=<accountId>`, executed atomically) or declines.
 */
export async function deleteAccount(userId: string, id: string, reassignTo?: string): Promise<{ reassignedTo?: string }> {
  const account = await prisma.account.findFirst({ where: { id, userId }, select: { id: true, name: true } });
  if (!account) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'That account does not exist.');

  const historyCount = await prisma.transaction.count({ where: { accountId: id, userId } });

  if (historyCount === 0) {
    await prisma.account.delete({ where: { id } });
    return {};
  }
  if (!reassignTo) {
    throw new ApiError(
      409,
      'ACCOUNT_HAS_HISTORY',
      `${account.name} holds ${historyCount} transaction(s). Pass reassignTo=<accountId> to move them to another account first.`,
    );
  }
  if (reassignTo === id) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Cannot reassign transactions to the account being deleted.');
  }
  await assertOwnedAccount(userId, reassignTo);
  await prisma.$transaction([
    prisma.transaction.updateMany({ where: { accountId: id, userId }, data: { accountId: reassignTo } }),
    prisma.account.delete({ where: { id } }),
  ]);
  return { reassignedTo: reassignTo };
}
