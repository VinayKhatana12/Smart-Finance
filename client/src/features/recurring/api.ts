import { api } from '../../lib/apiClient';

export interface RecurringRule {
  id: string;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  type: 'INCOME' | 'EXPENSE';
  title: string;
  amountPaise: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: string;
  endDate: string | null;
  active: boolean;
  lastRunDate: string | null;
  nextRunDate: string;
}

export function fetchRecurring(): Promise<{ rules: RecurringRule[] }> {
  return api<{ rules: RecurringRule[] }>('/api/v1/recurring');
}

export function createRecurringRequest(values: {
  accountId: string;
  categoryId: string;
  type: 'INCOME' | 'EXPENSE';
  title: string;
  amountPaise: number;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: string;
  endDate?: string | null;
}): Promise<{ rule: RecurringRule }> {
  return api<{ rule: RecurringRule }>('/api/v1/recurring', { method: 'POST', body: values });
}

export function updateRecurringRequest(
  id: string,
  values: Partial<{ title: string; amountPaise: number; active: boolean; endDate: string | null }>,
): Promise<{ updated: boolean }> {
  return api<{ updated: boolean }>(`/api/v1/recurring/${id}`, { method: 'PATCH', body: values });
}

export function deleteRecurringRequest(id: string): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(`/api/v1/recurring/${id}`, { method: 'DELETE', body: {} });
}
