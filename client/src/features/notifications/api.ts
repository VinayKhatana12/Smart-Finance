import { api } from '../../lib/apiClient';

export interface NotificationItem {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export function fetchNotifications(unreadOnly: boolean): Promise<{ items: NotificationItem[]; unread: number }> {
  return api<{ items: NotificationItem[]; unread: number }>(`/api/v1/notifications${unreadOnly ? '?unread=true' : ''}`);
}

export function markReadRequest(id: string): Promise<{ updated: boolean }> {
  return api<{ updated: boolean }>(`/api/v1/notifications/${id}/read`, { method: 'POST', body: {} });
}

export function markAllReadRequest(): Promise<{ updated: boolean }> {
  return api<{ updated: boolean }>('/api/v1/notifications/read-all', { method: 'POST', body: {} });
}

export function clearNotificationRequest(id: string): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(`/api/v1/notifications/${id}`, { method: 'DELETE', body: {} });
}
