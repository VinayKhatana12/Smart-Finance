import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as accountsApi from './api';
import type { AccountType } from '../../types';

export function useAccounts() {
  return useQuery({ queryKey: ['accounts'], queryFn: accountsApi.fetchAccounts, select: (d) => d.accounts });
}

function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

export function useCreateAccount() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (values: { name: string; accountType: AccountType; openingBalancePaise: number; currency: string }) =>
      accountsApi.createAccountRequest(values),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteAccount() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string }) => accountsApi.deleteAccountRequest(id, reassignTo),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, ...values }: { id: string; name?: string; accountType?: AccountType; openingBalancePaise?: number }) =>
      accountsApi.updateAccountRequest(id, values),
    onSuccess: () => invalidate(),
  });
}

export type { AccountType };
