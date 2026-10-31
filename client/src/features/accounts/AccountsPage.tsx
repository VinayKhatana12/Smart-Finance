import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMe } from '../auth/hooks';
import { useTransactions } from '../transactions/hooks';
import { formatDate, formatMoney } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { Account, AccountType, Currency } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { Field, Input, Select } from '../../components/ui/Field';
import { EmptyState, Skeleton } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toaster';
import { PlusIcon } from '../../components/icons';
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from './hooks';

const ACCOUNT_TYPES: Array<{ id: AccountType; label: string }> = [
  { id: 'CASH', label: 'Cash' },
  { id: 'BANK', label: 'Bank' },
  { id: 'WALLET', label: 'Wallet' },
  { id: 'OTHER', label: 'Other' },
];

const typeLabel = (type: string): string => ACCOUNT_TYPES.find((t) => t.id === type)?.label ?? type;

const accountSchema = z.object({
  name: z.string().trim().min(1, 'Give the account a name.').max(60, 'Keep it under 60 characters.'),
  accountType: z.enum(['CASH', 'BANK', 'WALLET', 'OTHER']),
  openingBalance: z
    .number({ invalid_type_error: 'Enter a starting balance (0 is fine).' })
    .min(-999999999)
    .refine((n) => Number.isSafeInteger(Math.round(n * 100)), 'Use at most 2 decimal places.'),
});

type AccountFormValues = z.infer<typeof accountSchema>;

function AccountFormModal({
  open,
  onClose,
  account,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  account: Account | null;
  currency: Currency;
}) {
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    values: {
      name: account?.name ?? '',
      accountType: account?.accountType ?? 'BANK',
      openingBalance: account ? Number(account.openingBalancePaise) / 100 : (undefined as unknown as number),
    },
  });

  const onSubmit = (values: AccountFormValues) => {
    const payload = {
      name: values.name,
      accountType: values.accountType,
      openingBalancePaise: Math.round(values.openingBalance * 100),
    };
    const onError = (error: unknown) =>
      showToast(error instanceof Error ? error.message : 'Could not save the account.', 'error');
    if (account) {
      update.mutate(
        { id: account.id, ...payload },
        {
          onSuccess: () => {
            showToast('Account updated.', 'success');
            onClose();
          },
          onError,
        },
      );
    } else {
      create.mutate(
        { ...payload, currency },
        {
          onSuccess: () => {
            showToast('Account added.', 'success');
            onClose();
          },
          onError,
        },
      );
    }
  };

  const busy = isSubmitting || create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={account ? 'Edit account' : 'New account'}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Name" htmlFor="acc-name" error={errors.name?.message}>
          <Input id="acc-name" placeholder="HDFC Savings" invalid={Boolean(errors.name)} {...register('name')} />
        </Field>
        <Field label="Type" htmlFor="acc-type" error={errors.accountType?.message}>
          <Select id="acc-type" {...register('accountType')}>
            {ACCOUNT_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Starting balance"
          htmlFor="acc-opening"
          error={errors.openingBalance?.message}
          hint={account ? 'Editing this shifts the computed balance from today onward.' : 'The balance you start this account with.'}
        >
          <Input
            id="acc-opening"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0.00"
            invalid={Boolean(errors.openingBalance)}
            {...register('openingBalance', { valueAsNumber: true })}
          />
        </Field>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? 'Saving…' : account ? 'Save changes' : 'Add account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AccountHistory({ account, currency }: { account: Account; currency: Currency }) {
  const { data, isLoading } = useTransactions({ accountId: account.id, page: 1, pageSize: 6 });
  const rows = data?.items ?? [];
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-ink">{account.name}</h2>
        <span className="tnum text-[13px] text-muted">Latest activity</span>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No transactions on this account yet.</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id} className="flex items-baseline justify-between gap-3 border-t border-rule py-2.5 first:border-t-0">
              <span className="min-w-0 truncate text-[15px] text-ink">
                {row.description || row.categoryName}
                <span className="block text-[13px] text-muted">{formatDate(row.transactionDate)}</span>
              </span>
              <span className={cn('tnum text-[15px]', row.type === 'INCOME' ? 'text-positive' : 'text-ink')}>
                {formatMoney(row.type === 'INCOME' ? Number(row.amountPaise) : -Number(row.amountPaise), currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AccountsPage() {
  const me = useMe();
  const currency: Currency = me.data?.user.currency ?? 'INR';
  const { data: accounts, isLoading } = useAccounts();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [reassignTo, setReassignTo] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = accounts?.find((a) => a.id === selectedId) ?? null;
  const remove = useDeleteAccount();
  const { showToast } = useToast();

  const confirmDelete = () => {
    if (!deleting) return;
    setDeleteError(null);
    remove.mutate(
      { id: deleting.id, reassignTo: reassignTo || undefined },
      {
        onSuccess: () => {
          showToast('Account deleted.', 'success');
          if (selectedId === deleting.id) setSelectedId(null);
          setDeleting(null);
          setReassignTo('');
        },
        onError: (error) => {
          // 409: the account holds history — the same dialog offers reassignment
          setDeleteError(error instanceof Error ? error.message : 'Could not delete the account.');
        },
      },
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Accounts</h1>
          <p className="mt-0.5 text-sm text-muted">Where your money lives — balances are computed from your ledger.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <PlusIcon width={16} height={16} />
          Add account
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-24 rounded-[20px]" />
          <Skeleton className="h-24 rounded-[20px]" />
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <div className="mt-6">
          <Card>
            <EmptyState
              message="No accounts yet. Add the places your money lives — cash, bank, wallet — and record transactions against them."
              action={
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <PlusIcon width={16} height={16} />
                  Add account
                </Button>
              }
            />
          </Card>
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_400px]">
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((account) => (
              <Card key={account.id} className={cn(selectedId === account.id && 'outline outline-2 outline-accent')}>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-semibold text-ink">{account.name}</h2>
                    <p className="text-[13px] text-muted">{typeLabel(account.accountType)}</p>
                  </div>
                  <span className="tnum text-[20px] font-semibold tracking-tight text-ink">
                    {formatMoney(Number(account.balancePaise), currency)}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedId(selectedId === account.id ? null : account.id)}
                  >
                    {selectedId === account.id ? 'Hide history' : 'History'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(account);
                      setFormOpen(true);
                    }}
                    className="rounded-[8px] px-2 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-soft"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleting(account);
                      setReassignTo('');
                      setDeleteError(null);
                    }}
                    className="rounded-[8px] px-2 py-1.5 text-sm font-medium text-muted hover:text-negative"
                  >
                    Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
          <div className="lg:sticky lg:top-6">{selected ? <AccountHistory account={selected} currency={currency} /> : null}</div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        onConfirm={confirmDelete}
        title={deleting ? `Delete ${deleting.name}` : ''}
        body="Deleting removes the account and its computed balance from your totals. Transactions recorded on it are kept only if you move them to another account first."
        confirmLabel={remove.isPending ? 'Deleting…' : 'Delete account'}
        busy={remove.isPending}
      >
        {deleting && (accounts?.length ?? 0) > 1 ? (
          <div className="mt-3 flex flex-col gap-2">
            <label htmlFor="reassign-select" className="text-sm font-medium text-ink">
              Move its transactions to
            </label>
            <Select id="reassign-select" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
              <option value="">Another account (required if it has history)…</option>
              {accounts
                ?.filter((a) => a.id !== deleting.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </div>
        ) : null}
        {deleteError ? (
          <p role="alert" className="mt-3 rounded-[8px] border border-dashed border-control px-3 py-2 text-[13px] text-negative">
            {deleteError}
          </p>
        ) : null}
      </ConfirmDialog>

      <AccountFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        account={editing}
        currency={currency}
      />
    </div>
  );
}
