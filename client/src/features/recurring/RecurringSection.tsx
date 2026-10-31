import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMe } from '../auth/hooks';
import { useCategories } from '../transactions/hooks';
import { useAccounts } from '../accounts/hooks';
import { toDayIso, formatDate, formatMoney } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { RecurringRule } from './api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { Field, Input, Select } from '../../components/ui/Field';
import { EmptyState, Skeleton } from '../../components/ui/States';
import { Pill } from '../../components/ui/Pill';
import { Segmented } from '../../components/ui/Controls';
import { useToast } from '../../components/ui/Toaster';
import { PlusIcon } from '../../components/icons';
import { useCreateRecurring, useDeleteRecurring, useRecurring, useUpdateRecurring } from './hooks';

type Tab = 'transactions' | 'recurring';

const ruleSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the rule a title.').max(80, 'Keep it under 80 characters.'),
    accountId: z.string().min(1, 'Pick an account.'),
    categoryId: z.string().min(1, 'Pick a category.'),
    type: z.enum(['INCOME', 'EXPENSE']),
    amount: z
      .number({ invalid_type_error: 'Enter an amount.' })
      .positive('Enter an amount greater than zero.')
      .refine((n) => Number.isSafeInteger(Math.round(n * 100)), 'That amount is too large.'),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker.'),
    endDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: 'The end date is before the start date.',
    path: ['endDate'],
  });

type RuleFormValues = z.infer<typeof ruleSchema>;

const FREQ_LABEL: Record<RecurringRule['frequency'], string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

function RuleFormModal({
  open,
  onClose,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Array<{ id: string; name: string }>;
}) {
  const create = useCreateRecurring();
  const { showToast } = useToast();
  const { data: categories } = useCategories();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    values: {
      title: '',
      accountId: accounts[0]?.id ?? '',
      categoryId: '',
      type: 'EXPENSE',
      amount: undefined as unknown as number,
      frequency: 'MONTHLY',
      startDate: toDayIso(new Date()),
      endDate: '',
    },
  });

  const type = watch('type');
  const options = (categories ?? []).filter((c) => (type === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE'));

  const onSubmit = (values: RuleFormValues) => {
    create.mutate(
      {
        title: values.title,
        accountId: values.accountId,
        categoryId: values.categoryId,
        type: values.type,
        amountPaise: Math.round(values.amount * 100),
        frequency: values.frequency,
        startDate: values.startDate,
        endDate: values.endDate ? values.endDate : null,
      },
      {
        onSuccess: () => {
          showToast('Recurring rule created.', 'success');
          onClose();
        },
        onError: (error) => showToast(error instanceof Error ? error.message : 'Could not create the rule.', 'error'),
      },
    );
  };

  const busy = isSubmitting || create.isPending;

  return (
    <Modal open={open} onClose={onClose} title="New recurring rule" wide>
      {accounts.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-control px-4 py-6 text-center">
          <p className="text-sm text-muted">You need an account first — add one on the Accounts page.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Field label="Title" htmlFor="rec-title" error={errors.title?.message}>
            <Input id="rec-title" placeholder="Monthly rent" invalid={Boolean(errors.title)} {...register('title')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Account" htmlFor="rec-account" error={errors.accountId?.message}>
              <Select id="rec-account" {...register('accountId')}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type" htmlFor="rec-type">
              <Segmented
                label="Rule type"
                options={[
                  { id: 'EXPENSE', label: 'Expense' },
                  { id: 'INCOME', label: 'Income' },
                ]}
                value={type}
                onChange={(next) => setValue('type', next)}
              />
            </Field>
          </div>
          <Field label="Category" htmlFor="rec-category" error={errors.categoryId?.message}>
            <Select id="rec-category" invalid={Boolean(errors.categoryId)} {...register('categoryId')}>
              <option value="">Pick a category…</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount" htmlFor="rec-amount" error={errors.amount?.message}>
              <Input
                id="rec-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                invalid={Boolean(errors.amount)}
                {...register('amount', { valueAsNumber: true })}
              />
            </Field>
            <Field label="Frequency" htmlFor="rec-frequency" error={errors.frequency?.message}>
              <Select id="rec-frequency" {...register('frequency')}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts on" htmlFor="rec-start" error={errors.startDate?.message}>
              <Input id="rec-start" type="date" {...register('startDate')} />
            </Field>
            <Field label="Ends on (optional)" htmlFor="rec-end" error={errors.endDate?.message}>
              <Input id="rec-end" type="date" {...register('endDate')} />
            </Field>
          </div>
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Creating…' : 'Create rule'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function RecurringSection() {
  const me = useMe();
  const currency = me.data?.user.currency ?? 'INR';
  const { data: accountsData } = useAccounts();
  const accounts = accountsData ?? [];
  const { data: rules, isLoading } = useRecurring();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<RecurringRule | null>(null);
  const remove = useDeleteRecurring();
  const update = useUpdateRecurring();
  const { showToast } = useToast();

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        showToast('Rule deleted. Generated transactions stay in your ledger.', 'success');
        setDeleting(null);
      },
      onError: () => showToast('Could not delete the rule.', 'error'),
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="max-w-[60ch] text-sm text-muted">
          Rules book transactions automatically — daily, weekly, monthly or yearly. Each generated entry is
          deduplicated by its occurrence date, so running twice never books twice.
        </p>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <PlusIcon width={16} height={16} />
          New rule
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 rounded-[20px]" />
          <Skeleton className="h-16 rounded-[20px]" />
        </div>
      ) : !rules || rules.length === 0 ? (
        <div className="mt-4">
          <Card>
            <EmptyState message="No recurring rules yet. Set one up for rent, salary, subscriptions — anything that repeats." />
          </Card>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rules.map((rule) => (
            <li key={rule.id} className="rounded-[20px] border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[15px] font-semibold text-ink">{rule.title}</span>
                <span className="flex items-center gap-2">
                  <Pill tone={rule.active ? 'accent' : 'neutral'}>{rule.active ? 'Active' : 'Paused'}</Pill>
                  <Pill tone="neutral">{FREQ_LABEL[rule.frequency]}</Pill>
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-[14px]">
                <span className="text-muted">
                  {rule.categoryName} · {rule.accountName}
                </span>
                <span className={cn('tnum font-semibold', rule.type === 'INCOME' ? 'text-positive' : 'text-ink')}>
                  {formatMoney(Number(rule.amountPaise), currency, { signed: rule.type === 'INCOME' })}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                Started {formatDate(`${rule.startDate}T00:00:00.000Z`)} · next{' '}
                {formatDate(`${rule.nextRunDate}T00:00:00.000Z`)}
              </p>
              <div className="mt-2 flex gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => update.mutate({ id: rule.id, active: !rule.active })}
                  className="font-medium text-accent-ink hover:underline"
                >
                  {rule.active ? 'Pause' : 'Resume'}
                </button>
                <button type="button" onClick={() => setDeleting(rule)} className="font-medium text-muted hover:text-negative">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <RuleFormModal open={formOpen} onClose={() => setFormOpen(false)} accounts={accounts} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete recurring rule"
        body={deleting ? `Delete "${deleting.title}"? Already-generated transactions stay in your ledger.` : ''}
        busy={remove.isPending}
      />
    </div>
  );
}

export type { Tab };
