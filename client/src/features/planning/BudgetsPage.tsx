import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMe } from '../auth/hooks';
import { currentMonthKey, formatMoney, monthLabel, shiftMonth } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { Budget } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { Field, Input, Select } from '../../components/ui/Field';
import { EmptyState, Skeleton } from '../../components/ui/States';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useToast } from '../../components/ui/Toaster';
import { PlusIcon } from '../../components/icons';
import { useBudgets, useCategories, useCreateBudget, useDeleteBudget, useUpdateBudget } from './hooks';

const budgetSchema = z.object({
  categoryId: z.string().min(1, 'Pick a category.'),
  limit: z
    .number({ invalid_type_error: 'Enter a limit.' })
    .positive('Enter an amount greater than zero.')
    .refine((n) => Number.isSafeInteger(Math.round(n * 100)), 'That amount is too large.'),
});

type BudgetFormValues = z.infer<typeof budgetSchema>;

function BudgetFormModal({
  open,
  onClose,
  month,
  year,
  budget,
  takenCategoryIds,
}: {
  open: boolean;
  onClose: () => void;
  month: number;
  year: number;
  budget: Budget | null;
  takenCategoryIds: string[];
}) {
  const create = useCreateBudget();
  const update = useUpdateBudget();
  const { showToast } = useToast();
  const { data: categories } = useCategories();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    values: {
      categoryId: budget?.categoryId ?? '',
      limit: budget ? Number(budget.limitPaise) / 100 : (undefined as unknown as number),
    },
  });

  const onSubmit = (values: BudgetFormValues) => {
    const limitPaise = Math.round(values.limit * 100);
    const onError = (error: unknown) =>
      showToast(error instanceof Error ? error.message : 'Could not save the budget.', 'error');
    if (budget) {
      update.mutate(
        { id: budget.id, limitPaise },
        {
          onSuccess: () => {
            showToast('Budget updated.', 'success');
            onClose();
          },
          onError,
        },
      );
    } else {
      create.mutate(
        { categoryId: values.categoryId, month, year, limitPaise },
        {
          onSuccess: () => {
            showToast('Budget set.', 'success');
            onClose();
          },
          onError,
        },
      );
    }
  };

  const busy = isSubmitting || create.isPending || update.isPending;
  const expenseCategories = (categories ?? []).filter(
    (c) => c.type === 'EXPENSE' && (!takenCategoryIds.includes(c.id) || budget?.categoryId === c.id),
  );

  return (
    <Modal open={open} onClose={onClose} title={budget ? `Edit ${budget.categoryName} budget` : 'New budget'}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <p className="text-[13px] text-muted">{monthLabel(monthKeyOf(month, year))} · one limit per category</p>
        <Field label="Category" htmlFor="budget-category" error={errors.categoryId?.message}>
          <Select id="budget-category" disabled={Boolean(budget)} invalid={Boolean(errors.categoryId)} {...register('categoryId')}>
            <option value="">Pick a category…</option>
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Monthly limit" htmlFor="budget-limit" error={errors.limit?.message}>
          <Input
            id="budget-limit"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            invalid={Boolean(errors.limit)}
            {...register('limit', { valueAsNumber: true })}
          />
        </Field>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? 'Saving…' : budget ? 'Save changes' : 'Set budget'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const monthKeyOf = (month: number, year: number): string => `${year}-${String(month).padStart(2, '0')}`;

function budgetTone(percent: number): 'ink' | 'warning' | 'negative' {
  if (percent >= 100) return 'negative';
  if (percent >= 90) return 'warning';
  return 'ink';
}

export function BudgetsPage() {
  const me = useMe();
  const [monthKeyState, setMonthKey] = useState(currentMonthKey());
  const [year, month] = monthKeyState.split('-').map(Number);
  const { data: budgets, isLoading } = useBudgets(month!, year!);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const remove = useDeleteBudget();
  const { showToast } = useToast();
  const currency = me.data?.user.currency ?? 'INR';

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        showToast('Budget removed.', 'success');
        setDeleting(null);
      },
      onError: () => showToast('Could not remove the budget.', 'error'),
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Budgets</h1>
          <p className="mt-0.5 text-sm text-muted">A limit per category — spent fills the bar as the month moves.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <PlusIcon width={16} height={16} />
          New budget
        </Button>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonthKey(shiftMonth(monthKeyState, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-control bg-surface text-ink hover:border-muted"
        >
          ‹
        </button>
        <span className="text-[15px] font-medium text-ink">{monthLabel(monthKeyState)}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonthKey(shiftMonth(monthKeyState, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-control bg-surface text-ink hover:border-muted"
        >
          ›
        </button>
      </div>

      {isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36 rounded-[20px]" />
          <Skeleton className="h-36 rounded-[20px]" />
        </div>
      ) : !budgets || budgets.length === 0 ? (
        <div className="mt-6">
          <Card>
            <CardHeader title={monthLabel(monthKeyState)} />
            <EmptyState
              message="No budgets for this month yet. Set a limit for a category and watch the bar fill as you spend."
              action={
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <PlusIcon width={16} height={16} />
                  Set first budget
                </Button>
              }
            />
          </Card>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {budgets.map((budget) => {
            const limit = Number(budget.limitPaise);
            const spent = Number(budget.spentPaise);
            return (
              <Card key={budget.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[15px] font-semibold text-ink">{budget.categoryName}</h2>
                  <span className="tnum text-[13px] text-muted">{budget.percent}%</span>
                </div>
                <div className="tnum mt-2 text-[22px] font-semibold tracking-tight text-ink">
                  {formatMoney(spent, currency)}
                  <span className="ml-2 text-[13px] font-normal text-muted">of {formatMoney(limit, currency)}</span>
                </div>
                <ProgressBar className="mt-3" ratio={limit > 0 ? spent / limit : 0} tone={budgetTone(budget.percent)} />
                <div className="mt-2 flex items-baseline justify-between">
                  <span className={cn('tnum text-[13px]', budget.remainingPaise.startsWith('-') ? 'text-negative' : 'text-muted')}>
                    {budget.remainingPaise.startsWith('-')
                      ? `${formatMoney(-Number(budget.remainingPaise), currency)} over`
                      : `${formatMoney(Number(budget.remainingPaise), currency)} left`}
                  </span>
                  <span className="flex gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(budget);
                        setFormOpen(true);
                      }}
                      className="font-medium text-accent-ink hover:underline"
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => setDeleting(budget)} className="font-medium text-muted hover:text-negative">
                      Delete
                    </button>
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <BudgetFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        month={month!}
        year={year!}
        budget={editing}
        takenCategoryIds={(budgets ?? []).map((b) => b.categoryId)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Remove budget"
        body={deleting ? `Remove the ${deleting.categoryName} budget? Your transactions are untouched.` : ''}
        busy={remove.isPending}
      />
    </div>
  );
}
