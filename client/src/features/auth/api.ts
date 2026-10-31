import { api } from '../../lib/apiClient';
import type { Currency, User } from '../../types';

export interface AuthResponse {
  user: User;
}

export function fetchMe(): Promise<AuthResponse> {
  return api<AuthResponse>('/api/v1/auth/me');
}

export function loginRequest(values: { email: string; password: string }): Promise<AuthResponse> {
  return api<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: values });
}

export function signupRequest(values: {
  name: string;
  email: string;
  password: string;
  currency: Currency;
}): Promise<AuthResponse> {
  return api<AuthResponse>('/api/v1/auth/register', { method: 'POST', body: values });
}

export function logoutRequest(): Promise<{ loggedOut: boolean }> {
  return api<{ loggedOut: boolean }>('/api/v1/auth/logout', { method: 'POST', body: {} });
}

export function updateProfileRequest(values: {
  name?: string;
  currency?: Currency;
  timezone?: string;
}): Promise<AuthResponse> {
  return api<AuthResponse>('/api/v1/users/profile', { method: 'PATCH', body: values });
}
