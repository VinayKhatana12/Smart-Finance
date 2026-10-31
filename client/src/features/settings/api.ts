import { api } from '../../lib/apiClient';
import type { User } from '../../types';

export function changePasswordRequest(values: { currentPassword: string; newPassword: string }): Promise<{ updated: boolean }> {
  return api<{ updated: boolean }>('/api/v1/users/password', { method: 'PATCH', body: values });
}

export function forgotPasswordRequest(email: string): Promise<{ sent: true; resetUrl?: string }> {
  return api<{ sent: true; resetUrl?: string }>('/api/v1/auth/forgot', { method: 'POST', body: { email } });
}

export function resetPasswordRequest(values: { token: string; password: string }): Promise<{ reset: true }> {
  return api<{ reset: true }>('/api/v1/auth/reset', { method: 'POST', body: values });
}

export type { User };
