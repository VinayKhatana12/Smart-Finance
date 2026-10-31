import { api } from '../../lib/apiClient';
import type { Budget, Contribution, Goal } from '../../types';

export function fetchBudgets(month: number, year: number): Promise<{ budgets: Budget[] }> {
  return api<{ budgets: Budget[] }>(`/api/v1/budgets?month=${month}&year=${year}`);
}

export function createBudgetRequest(values: { categoryId: string; month: number; year: number; limitPaise: number }): Promise<{ budget: Budget }> {
  return api<{ budget: Budget }>('/api/v1/budgets', { method: 'POST', body: values });
}

export function updateBudgetRequest(id: string, limitPaise: number): Promise<{ updated: boolean }> {
  return api<{ updated: boolean }>(`/api/v1/budgets/${id}`, { method: 'PATCH', body: { limitPaise } });
}

export function deleteBudgetRequest(id: string): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(`/api/v1/budgets/${id}`, { method: 'DELETE', body: {} });
}

export function fetchGoals(): Promise<{ goals: Goal[] }> {
  return api<{ goals: Goal[] }>('/api/v1/goals');
}

export function createGoalRequest(values: { title: string; targetPaise: number; deadline?: string | null }): Promise<{ goal: Goal }> {
  return api<{ goal: Goal }>('/api/v1/goals', { method: 'POST', body: values });
}

export function updateGoalRequest(id: string, values: Partial<{ title: string; targetPaise: number; deadline: string | null; status: Goal['status'] }>): Promise<{ updated: boolean }> {
  return api<{ updated: boolean }>(`/api/v1/goals/${id}`, { method: 'PATCH', body: values });
}

export function deleteGoalRequest(id: string): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(`/api/v1/goals/${id}`, { method: 'DELETE', body: {} });
}

export function addContributionRequest(goalId: string, values: { amountPaise: number; notes: string; contributionDate?: string }): Promise<{ savedPaise: string }> {
  return api<{ savedPaise: string }>(`/api/v1/goals/${goalId}/contributions`, { method: 'POST', body: values });
}

export function fetchContributions(goalId: string): Promise<{ contributions: Contribution[] }> {
  return api<{ contributions: Contribution[] }>(`/api/v1/goals/${goalId}/contributions`);
}
