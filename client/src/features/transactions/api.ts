import { api } from '../../lib/apiClient';
import type { Category, Paged, Transaction, TransactionType } from '../../types';

export function fetchAccounts(): Promise<{ accounts: { id: string; name: string; accountType: string; balancePaise: string; currency: string; openingBalancePaise: string; createdAt: string }[] }> {
  return api<{ accounts: { id: string; name: string; accountType: string; balancePaise: string; currency: string; openingBalancePaise: string; createdAt: string }[] }>('/api/v1/accounts');
}

export type { TransactionType };

export interface TransactionFilters {
  q?: string;
  type?: TransactionType;
  categoryId?: string;
  accountId?: string;
  from?: string;
  to?: string;
  sort?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
  page: number;
  pageSize: number;
}

function toQuery(filters: TransactionFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.type) params.set('type', filters.type);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.accountId) params.set('accountId', filters.accountId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.sort) params.set('sort', filters.sort);
  params.set('page', String(filters.page));
  params.set('pageSize', String(filters.pageSize));
  return params.toString();
}

export function fetchTransactions(filters: TransactionFilters): Promise<Paged<Transaction>> {
  return api<Paged<Transaction>>(`/api/v1/transactions?${toQuery(filters)}`);
}

export function exportUrl(filters: TransactionFilters): string {
  return `/api/v1/transactions/export?${toQuery(filters)}`;
}

export function fetchCategories(): Promise<{ categories: Category[] }> {
  return api<{ categories: Category[] }>('/api/v1/categories');
}

export interface TransactionPayload {
  accountId: string;
  type: TransactionType;
  amountPaise: number;
  categoryId?: string;
  transferAccountId?: string | null;
  description: string;
  notes: string;
  transactionDate: string;
}

export function createTransactionRequest(values: TransactionPayload): Promise<{ transaction: Transaction }> {
  return api<{ transaction: Transaction }>('/api/v1/transactions', { method: 'POST', body: values });
}

export function updateTransactionRequest(id: string, values: Partial<TransactionPayload>): Promise<{ transaction: Transaction }> {
  return api<{ transaction: Transaction }>(`/api/v1/transactions/${id}`, { method: 'PATCH', body: values });
}

export function deleteTransactionRequest(id: string): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(`/api/v1/transactions/${id}`, { method: 'DELETE', body: {} });
}
