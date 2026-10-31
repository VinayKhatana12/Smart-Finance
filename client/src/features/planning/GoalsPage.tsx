import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMe } from '../auth/hooks';
import { formatDate, formatMoney } from '../../lib/format';
import type { Currency, Goal } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { Field, Input } from '../../components/ui/Field';
import { EmptyState, Skeleton } from '../../components/ui/States';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Pill } from '../../components/ui/Pill';
import { useToast } from '../../components/ui/Toaster';
import { PlusIcon } from '../../components/icons';
import { Ring } from '../../components/ui/Ring';
import { useAddContribution, useContributions, useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from './hooks';

const goalSchema = z.object({
  title: z.string().trim().min(1, 'Give the goal a title.').max(80, 'Keep it under 80 characters.'),
  target: z
    .number({ invalid_type_error: 'Enter a target amount.' })
    .positive('Enter an amount greater than zero.')
    .refine((n) => Number.isSafeInteger(Math.round(n * 100)), 'That amount is too large.'),
  deadline: z
    .union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker.')])
    .optional(),
});

type GoalFormValues = z.infer<typeof goalSchema>;

const contributionSchema = z.object({
  amount: z
    .number({ invalid_type_error: 'Enter an amount.' })
    .positive('Enter an amount greater than zero.')
    .refine((n) => Number.isSafeInteger(Math.round(n * 100)), 'That amount is too large.'),
  notes: z.string().trim().max(200, 'Keep it under 200 characters.'),
  contributionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker.'),
});

type ContributionValues = z.infer<typeof contributionSchema>;

/** Client-side pot tint from the goal id — purely visual, the data stays honest. */
const POT_TONES = [
  { soft: '#dcf1ff', ink: '#0a3a80' },
  { soft: '#d8f0ee', ink: '#0c4a44' },
  { soft: '#dcfae5', ink: '#14532d' },
  { soft: '#fdf0d9', ink: '#7c4a03' },
  { soft: '#ffe4e6', ink: '#881337' },
  { soft: '#e9e3fb', ink: '#3b2670' },
];

const potTone = (goal: Goal): { soft: string; ink: string } => {
  let hash = 0;
  for (const ch of goal.id) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return POT_TONES[hash % POT_TONES.length]!;
};

function GoalFormModal({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: Goal | null }) {
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    values: {
      title: goal?.title ?? '',
      target: goal ? Number(goal.targetPaise) / 100 : (undefined as unknown as number),
      deadline: goal?.deadline ?? '',
    },
  });

  const onSubmit = (values: GoalFormValues) => {
    const deadline = values.deadline ? values.deadline : null;
    const onError = (error: unknown) =>
      showToast(error instanceof Error ? error.message : 'Could not save the goal.', 'error');
    if (goal) {
      update.mutate(
        { id: goal.id, title: values.title, targetPaise: Math.round(values.target * 100), deadline },
        {
          onSuccess: () => {
            showToast('Goal updated.', 'success');
            onClose();
          },
          onError,
        },
      );
    } else {
      create.mutate(
        { title: values.title, targetPaise: Math.round(values.target * 100), deadline },
        {
          onSuccess: () => {
            showToast('Goal created.', 'success');
            onClose();
          },
          onError,
        },
      );
    }
  };

  const busy = isSubmitting || create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={goal ? 'Edit goal' : 'New goal'}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Title" htmlFor="goal-title" error={errors.title?.message}>
          <Input id="goal-title" placeholder="Emergency fund" invalid={Boolean(errors.title)} {...register('title')} />
        </Field>
        <Field label="Target" htmlFor="goal-target" error={errors.target?.message}>
          <Input
            id="goal-target"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            invalid={Boolean(errors.target)}
            {...register('target', { valueAsNumber: true })}
          />
        </Field>
        <Field label="Deadline (optional)" htmlFor="goal-deadline" error={errors.deadline?.message}>
          <Input id="goal-deadline" type="date" {...register('deadline')} />
        </Field>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? 'Saving…' : goal ? 'Save changes' : 'Create goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ContributeModal({ goal, currency, onClose }: { goal: Goal | null; currency: Currency; onClose: () => void }) {
  const add = useAddContribution();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContributionValues>({
    resolver: zodResolver(contributionSchema),
    values: {
      amount: undefined as unknown as number,
      notes: '',
      contributionDate: new Date().toISOString().slice(0, 10),
    },
  });

  if (!goal) return null;

  const onSubmit = (values: ContributionValues) => {
    add.mutate(
      {
        goalId: goal.id,
        amountPaise: Math.round(values.amount * 100),
        notes: values.notes,
        contributionDate: values.contributionDate,
      },
      {
        onSuccess: () => {
          showToast('Contribution added.', 'success');
          onClose();
        },
        onError: (error) => showToast(error instanceof Error ? error.message : 'Could not add the contribution.', 'error'),
      },
    );
  };

  return (
    <Modal open onClose={onClose} title={`Add to ${goal.title}`}>
      <p className="tnum text-[15px] text-muted">
        {formatMoney(Number(goal.savedPaise), currency)} of {formatMoney(Number(goal.targetPaise), currency)} so far —{' '}
        {formatMoney(Number(goal.remainingPaise), currency)} to go.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount" htmlFor="contrib-amount" error={errors.amount?.message}>
            <Input
              id="contrib-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              invalid={Boolean(errors.amount)}
              {...register('amount', { valueAsNumber: true })}
            />
          </Field>
          <Field label="Date" htmlFor="contrib-date" error={errors.contributionDate?.message}>
            <Input id="contrib-date" type="date" {...register('contributionDate')} />
          </Field>
        </div>
        <Field label="Note (optional)" htmlFor="contrib-note" error={errors.notes?.message}>
          <Input id="contrib-note" placeholder="October spare cash" {...register('notes')} />
        </Field>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting || add.isPending}>
            {isSubmitting || add.isPending ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ContributionHistory({ goalId, currency }: { goalId: string; currency: Currency }) {
  const { data: contributions, isLoading } = useContributions(goalId);
  if (isLoading) return <p className="text-sm text-muted">Loading history…</p>;
  if (!contributions || contributions.length === 0) return <p className="text-sm text-muted">No contributions yet.</p>;
  return (
    <ul className="mt-2">
      {contributions.map((contribution) => (
        <li key={contribution.id} className="flex items-baseline justify-between gap-3 border-t border-rule py-2 first:border-t-0">
          <span className="min-w-0 truncate text-[14px] text-muted">{contribution.notes || 'Contribution'}</span>
          <span className="text-right">
            <span className="tnum block text-[14px] text-ink">
              {formatMoney(Number(contribution.amountPaise), currency, { signed: true })}
            </span>
            <span className="block text-[12px] text-muted">{formatDate(contribution.contributionDate)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function GoalsPage() {
  const me = useMe();
  const { data: goals, isLoading } = useGoals();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const remove = useDeleteGoal();
  const { showToast } = useToast();
  const currency = me.data?.user.currency ?? 'INR';

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        showToast('Goal deleted.', 'success');
        setDeleting(null);
      },
      onError: () => showToast('Could not delete the goal.', 'error'),
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Savings goals</h1>
          <p className="mt-0.5 text-sm text-muted">Pots that fill toward the things you are saving for.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <PlusIcon width={16} height={16} />
          New goal
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-[20px]" />
          <Skeleton className="h-40 rounded-[20px]" />
        </div>
      ) : !goals || goals.length === 0 ? (
        <div className="mt-6">
          <Card>
            <EmptyState
              message="No goals yet. Create a pot for an emergency fund, a trip, a deposit — each with its own target and deadline."
              action={
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <PlusIcon width={16} height={16} />
                  Create first goal
                </Button>
              }
            />
          </Card>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const tone = potTone(goal);
            const achieved = goal.status === 'ACHIEVED';
            return (
              <Card key={goal.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-ink">{goal.title}</h2>
                    {achieved ? <Pill tone="positive">Achieved</Pill> : null}
                    {goal.deadline && !achieved ? (
                      <p className="mt-0.5 text-[13px] text-muted">by {formatDate(`${goal.deadline}T00:00:00.000Z`)}</p>
                    ) : null}
                  </div>
                  <Ring ratio={goal.percent / 100} size={56} strokeWidth={5} label={`${goal.percent}%`} />
                </div>
                <div className="tnum mt-3 text-[18px] font-semibold tracking-tight text-ink">
                  {formatMoney(Number(goal.savedPaise), currency)}
                  <span className="ml-2 text-[13px] font-normal text-muted">
                    of {formatMoney(Number(goal.targetPaise), currency)}
                  </span>
                </div>
                <ProgressBar className="mt-2.5" ratio={Number(goal.savedPaise) / Number(goal.targetPaise)} tone={achieved ? 'positive' : 'ink'} />
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setHistoryId(historyId === goal.id ? null : goal.id)}
                    className="text-sm font-medium text-accent-ink hover:underline"
                  >
                    {historyId === goal.id ? 'Hide history' : 'History'}
                  </button>
                  <span className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setContributing(goal)} disabled={achieved}>
                      <PlusIcon width={14} height={14} />
                      Add money
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(goal);
                        setFormOpen(true);
                      }}
                      className="px-1 text-sm font-medium text-accent-ink hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(goal)}
                      className="px-1 text-sm font-medium text-muted hover:text-negative"
                    >
                      Delete
                    </button>
                  </span>
                </div>
                {historyId === goal.id ? <ContributionHistory goalId={goal.id} currency={currency} /> : null}
                <span className="sr-only" style={{ color: tone.ink }}>
                  pot
                </span>
              </Card>
            );
          })}
        </div>
      )}

      <GoalFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        goal={editing}
      />
      <ContributeModal goal={contributing} currency={currency} onClose={() => setContributing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete goal"
        body={deleting ? `Delete "${deleting.title}" and its contribution history? This cannot be undone.` : ''}
        busy={remove.isPending}
      />
    </div>
  );
}
