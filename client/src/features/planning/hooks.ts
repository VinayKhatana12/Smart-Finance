import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';
import type { Goal } from '../../types';

export function useBudgets(month: number, year: number) {
  return useQuery({ queryKey: ['budgets', month, year], queryFn: () => api.fetchBudgets(month, year), select: (d) => d.budgets });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => import('../transactions/api').then((m) => m.fetchCategories()),
    staleTime: 5 * 60_000,
    select: (d) => d.categories,
  });
}

export function useGoals() {
  return useQuery({ queryKey: ['goals'], queryFn: api.fetchGoals, select: (d) => d.goals });
}

export function useContributions(goalId: string | null) {
  return useQuery({
    queryKey: ['contributions', goalId],
    queryFn: () => api.fetchContributions(goalId!),
    enabled: Boolean(goalId),
    select: (d) => d.contributions,
  });
}

function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

export function useCreateBudget() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: api.createBudgetRequest, onSuccess: () => invalidate() });
}

export function useUpdateBudget() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, limitPaise }: { id: string; limitPaise: number }) => api.updateBudgetRequest(id, limitPaise),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteBudget() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: api.deleteBudgetRequest, onSuccess: () => invalidate() });
}

export interface UpdateGoalArgs {
  id: string;
  title?: string;
  targetPaise?: number;
  deadline?: string | null;
  status?: Goal['status'];
}

export function useCreateGoal() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: api.createGoalRequest, onSuccess: () => invalidate() });
}

export function useUpdateGoal() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, ...values }: UpdateGoalArgs) => api.updateGoalRequest(id, values),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteGoal() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: api.deleteGoalRequest, onSuccess: () => invalidate() });
}

export function useAddContribution() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ goalId, ...values }: { goalId: string; amountPaise: number; notes: string; contributionDate?: string }) =>
      api.addContributionRequest(goalId, values),
    onSuccess: () => invalidate(),
  });
}
