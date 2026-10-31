import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';

export function useNotifications(unreadOnly: boolean) {
  return useQuery({ queryKey: ['notifications', unreadOnly], queryFn: () => api.fetchNotifications(unreadOnly) });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => api.fetchNotifications(false),
    select: (d) => d.unread,
    refetchInterval: 60_000,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
}

export function useMarkRead() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: api.markReadRequest, onSuccess: () => invalidate() });
}

export function useMarkAllRead() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: api.markAllReadRequest, onSuccess: () => invalidate() });
}

export function useClearNotification() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: api.clearNotificationRequest, onSuccess: () => invalidate() });
}
