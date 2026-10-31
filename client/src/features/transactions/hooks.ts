import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';
import type { TransactionFilters } from './api';
import type { TransactionType } from '../../types';

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => api.fetchTransactions(filters),
    placeholderData: (previous) => previous,
  });
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: api.fetchCategories, staleTime: 5 * 60_000, select: (d) => d.categories });
}

export interface UpdateTransactionArgs {
  id: string;
  accountId?: string;
  transferAccountId?: string | null;
  categoryId?: string;
  type?: TransactionType;
  amountPaise?: number;
  description?: string;
  notes?: string;
  transactionDate?: string;
}

function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

export function useCreateTransaction() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: api.createTransactionRequest, onSuccess: () => invalidate() });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, ...values }: UpdateTransactionArgs) => api.updateTransactionRequest(id, values),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: api.deleteTransactionRequest, onSuccess: () => invalidate() });
}
