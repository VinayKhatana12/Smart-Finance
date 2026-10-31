import { api as request } from '../../lib/apiClient';
import type { CategorySlice, DashboardRecent, DashboardSummary, MonthPoint, ReportSummary } from '../../types';

export function fetchDashboardSummary(month: number, year: number): Promise<DashboardSummary> {
  return request<DashboardSummary>(`/api/v1/dashboard/summary?month=${month}&year=${year}`);
}

export function fetchDashboardTrends(months: number): Promise<{ series: MonthPoint[] }> {
  return request<{ series: MonthPoint[] }>(`/api/v1/dashboard/trends?months=${months}`);
}

export function fetchDashboardCategories(month: number, year: number): Promise<{ categories: CategorySlice[] }> {
  return request<{ categories: CategorySlice[] }>(`/api/v1/dashboard/categories?month=${month}&year=${year}`);
}

export function fetchDashboardRecent(): Promise<{ transactions: DashboardRecent[] }> {
  return request<{ transactions: DashboardRecent[] }>('/api/v1/dashboard/recent-transactions');
}

export function fetchSummary(range: { from: string; to: string }): Promise<ReportSummary> {
  return request<ReportSummary>(`/api/v1/reports/summary?from=${range.from}&to=${range.to}`);
}

export function fetchMonthly(months: number): Promise<{ series: MonthPoint[] }> {
  return request<{ series: MonthPoint[] }>(`/api/v1/reports/monthly?months=${months}`);
}

export function fetchReportCategories(range: { from: string; to: string }): Promise<{ categories: CategorySlice[] }> {
  return request<{ categories: CategorySlice[] }>(`/api/v1/reports/categories?from=${range.from}&to=${range.to}`);
}

export function reportsExportUrl(range: { from: string; to: string }): string {
  return `/api/v1/reports/export?from=${range.from}&to=${range.to}`;
}

export interface Insight {
  kind: string;
  severity: 'info' | 'positive' | 'warning';
  title: string;
  detail: string;
}

export function fetchInsights(month: string): Promise<{ insights: Insight[] }> {
  return request<{ insights: Insight[] }>(`/api/v1/insights?month=${month}`);
}

export function askAssistant(question: string): Promise<{ source: 'rules' | 'llm'; answer: string; disclaimer: string }> {
  return request<{ source: 'rules' | 'llm'; answer: string; disclaimer: string }>('/api/v1/assistant/ask', {
    method: 'POST',
    body: { question },
  });
}

export const api = {
  fetchDashboardSummary,
  fetchDashboardTrends,
  fetchDashboardCategories,
  fetchDashboardRecent,
  fetchSummary,
  fetchMonthly,
  fetchReportCategories,
  fetchInsights,
  askAssistant,
  reportsExportUrl,
};
