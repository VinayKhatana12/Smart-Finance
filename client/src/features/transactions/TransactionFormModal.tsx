import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../lib/apiClient';
import { toDayIso } from '../../lib/format';
import type { Account, Transaction, TransactionType } from '../../types';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Controls';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toaster';
import { useCategories, useCreateTransaction, useUpdateTransaction } from './hooks';
import { queueTransaction } from '../../lib/offline-db';

const paise = z
  .number({ invalid_type_error: 'Enter an amount.' })
  .positive('Enter an amount greater than zero.')
  .refine((n) => Number.isSafeInteger(Math.round(n * 100)), 'That amount is too large.');

const formSchema = z
  .object({
    accountId: z.string().min(1, 'Pick an account.'),
    transferAccountId: z.string().optional(),
    type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
    amount: paise,
    categoryId: z.string().optional(),
    description: z.string().trim().max(140, 'Keep it under 140 characters.'),
    notes: z.string().trim().max(2000, 'Keep it under 2000 characters.'),
    transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker.'),
  })
  .refine((v) => (v.type === 'TRANSFER' ? Boolean(v.transferAccountId) && v.transferAccountId !== v.accountId : true), {
    message: 'A transfer needs a different destination account.',
    path: ['transferAccountId'],
  })
  .refine((v) => (v.type === 'TRANSFER' ? true : Boolean(v.categoryId)), {
    message: 'Pick a category.',
    path: ['categoryId'],
  });

type FormValues = z.infer<typeof formSchema>;

interface TransactionFormModalProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  transaction?: Transaction | null;
  defaultType?: TransactionType;
}

export function TransactionFormModal({ open, onClose, accounts, transaction, defaultType = 'EXPENSE' }: TransactionFormModalProps) {
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const { showToast } = useToast();
  const { data: categories } = useCategories();

  const editing = Boolean(transaction);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      accountId: transaction?.accountId ?? accounts[0]?.id ?? '',
      transferAccountId: transaction?.transferAccountId ?? '',
      type: transaction?.type ?? defaultType,
      amount: transaction ? Number(transaction.amountPaise) / 100 : (undefined as unknown as number),
      categoryId: transaction?.categoryId ?? '',
      description: transaction?.description ?? '',
      notes: transaction?.notes ?? '',
      transactionDate: transaction ? transaction.transactionDate.slice(0, 10) : toDayIso(new Date()),
    },
  });

  const type = watch('type');
  const options = (categories ?? []).filter((c) => (type === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE'));

  const onSubmit = (values: FormValues) => {
    const payload = {
      accountId: values.accountId,
      type: values.type,
      amountPaise: Math.round(values.amount * 100),
      categoryId: values.type === 'TRANSFER' ? undefined : values.categoryId!,
      transferAccountId: values.type === 'TRANSFER' ? values.transferAccountId : undefined,
      description: values.description,
      notes: values.notes,
      transactionDate: values.transactionDate,
    };
    const onError = (error: unknown) => {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [path, message] of Object.entries(error.fieldErrors)) {
          setError(path as keyof FormValues, { message });
        }
      } else {
        showToast(error instanceof Error ? error.message : 'Could not save the transaction.', 'error');
      }
    };
    if (!navigator.onLine && !editing) {
      // Offline: queue locally with an idempotency key; syncs automatically later.
      void queueTransaction(payload).then(() => {
        showToast('Saved on this device - it will sync when you are back online.', 'info');
        onClose();
      });
      return;
    }
    if (editing && transaction) {
      update.mutate(
        { id: transaction.id, ...payload, categoryId: payload.categoryId ?? transaction.categoryId },
        {
          onSuccess: () => {
            showToast('Transaction updated.', 'success');
            onClose();
          },
          onError,
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          showToast('Transaction recorded.', 'success');
          onClose();
        },
        onError,
      });
    }
  };

  const busy = isSubmitting || create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit transaction' : 'New transaction'} wide>
      {accounts.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-control px-4 py-6 text-center">
          <p className="text-sm text-muted">You need an account first — add one on the Accounts page.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Field label="Account" htmlFor="txn-account" error={errors.accountId?.message}>
            <Select id="txn-account" {...register('accountId')}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Type" htmlFor="txn-type">
            <Segmented
              label="Transaction type"
              options={[
                { id: 'EXPENSE', label: 'Expense' },
                { id: 'INCOME', label: 'Income' },
                { id: 'TRANSFER', label: 'Transfer' },
              ]}
              value={type}
              onChange={(next) => {
                setValue('type', next);
                setValue('categoryId', '');
              }}
            />
          </Field>

          {type === 'TRANSFER' ? (
            <Field label="To account" htmlFor="txn-transfer" error={errors.transferAccountId?.message}>
              <Select id="txn-transfer" {...register('transferAccountId')}>
                <option value="">Pick the receiving account…</option>
                {accounts
                  .filter((account) => account.id !== watch('accountId'))
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <Field label="Category" htmlFor="txn-category" error={errors.categoryId?.message}>
              <Select id="txn-category" invalid={Boolean(errors.categoryId)} {...register('categoryId')}>
                <option value="">Pick a category…</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount" htmlFor="txn-amount" error={errors.amount?.message}>
              <Input
                id="txn-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                invalid={Boolean(errors.amount)}
                {...register('amount', { valueAsNumber: true })}
              />
            </Field>
            <Field label="Date" htmlFor="txn-date" error={errors.transactionDate?.message}>
              <Input id="txn-date" type="date" invalid={Boolean(errors.transactionDate)} {...register('transactionDate')} />
            </Field>
          </div>

          <Field label="Description" htmlFor="txn-description" error={errors.description?.message}>
            <Input id="txn-description" placeholder="Metro Grocers" invalid={Boolean(errors.description)} {...register('description')} />
          </Field>

          <Field label="Notes" htmlFor="txn-notes" error={errors.notes?.message}>
            <Textarea id="txn-notes" rows={3} placeholder="Anything worth remembering later" {...register('notes')} />
          </Field>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Record'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
