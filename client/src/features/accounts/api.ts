import { api } from '../../lib/apiClient';
import type { Account, AccountType } from '../../types';

export function fetchAccounts(): Promise<{ accounts: Account[] }> {
  return api<{ accounts: Account[] }>('/api/v1/accounts');
}

export function createAccountRequest(values: {
  name: string;
  accountType: AccountType;
  openingBalancePaise: number;
  currency: string;
}): Promise<{ account: Account }> {
  return api<{ account: Account }>('/api/v1/accounts', { method: 'POST', body: values });
}

export function updateAccountRequest(
  id: string,
  values: { name?: string; accountType?: AccountType; openingBalancePaise?: number },
): Promise<{ updated: boolean }> {
  return api<{ updated: boolean }>(`/api/v1/accounts/${id}`, { method: 'PATCH', body: values });
}

export function deleteAccountRequest(id: string, reassignTo?: string): Promise<{ deleted: boolean; reassignedTo?: string }> {
  const query = reassignTo ? `?reassignTo=${reassignTo}` : '';
  return api<{ deleted: boolean; reassignedTo?: string }>(`/api/v1/accounts/${id}${query}`, { method: 'DELETE', body: {} });
}
