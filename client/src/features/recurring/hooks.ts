import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';

export function useRecurring() {
  return useQuery({ queryKey: ['recurring'], queryFn: api.fetchRecurring, select: (d) => d.rules });
}

function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

export function useCreateRecurring() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: api.createRecurringRequest, onSuccess: () => invalidate() });
}

export function useUpdateRecurring() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, ...values }: { id: string; title?: string; amountPaise?: number; active?: boolean; endDate?: string | null }) =>
      api.updateRecurringRequest(id, values),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteRecurring() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: api.deleteRecurringRequest, onSuccess: () => invalidate() });
}
