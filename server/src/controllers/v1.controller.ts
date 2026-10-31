import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  accessCookieClearOptions,
  accessCookieOptions,
  refreshCookieClearOptions,
  refreshCookieOptions,
  csrfCookieOptions,
} from '../utils/cookies.js';
import * as authService from '../services/auth.service.js';
import * as usersService from '../services/users.service.js';
import * as accountsService from '../services/accounts.service.js';
import * as categoriesService from '../services/categories.service.js';
import * as transactionsService from '../services/transactions.service.js';
import * as budgetsService from '../services/budgets.service.js';
import * as goalsService from '../services/goals.service.js';
import * as dashboardService from '../services/dashboard.service.js';
import * as reportsService from '../services/reports.service.js';
import * as passwordResetService from '../services/password-reset.service.js';
import * as notificationsService from '../services/notifications.service.js';
import * as recurringService from '../services/recurring.service.js';
import * as insightsService from '../services/insights.service.js';
import * as assistantService from '../services/assistant.service.js';
import {
  budgetQuerySchema,
  monthYearQuerySchema as dashboardQuerySchema,
  monthsQuerySchema,
  rangeQuerySchema,
  transactionQuerySchema,
} from '../validation/v1.schema.js';
import type { AuthUser } from '../middleware/requireAuth.js';

const currentUser = (req: Request): AuthUser => req.user!;
const paramId = (req: Request): string => {
  const value = req.params.id;
  return Array.isArray(value) ? value[0]! : value!;
};

function issueSessionCookies(res: Response, tokens: authService.SessionTokens): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions());
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
}

// ---------- auth ----------

/** Mints (or echoes) the double-submit CSRF pair: readable cookie + body token. */
export const csrfToken = (req: Request, res: Response): void => {
  const existing = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const token = existing ?? randomBytes(32).toString('hex');
  if (!existing) {
    res.cookie(CSRF_COOKIE, token, csrfCookieOptions());
  }
  res.status(200).json({ success: true, data: { csrfToken: token } });
};

export const register = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.registerUser(req.body);
  issueSessionCookies(res, tokens);
  res.status(201).json({ success: true, data: { user } });
});

export const login = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.loginUser(req.body);
  issueSessionCookies(res, tokens);
  res.status(200).json({ success: true, data: { user } });
});

export const refresh = asyncHandler(async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!presented) {
    res.status(401).json({ success: false, error: { code: 'REFRESH_INVALID', message: 'No session to renew. Sign in again.' } });
    return;
  }
  const { user, tokens } = await authService.refreshSession(presented);
  issueSessionCookies(res, tokens);
  res.status(200).json({ success: true, data: { user } });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.revokeSession(req.cookies?.[REFRESH_COOKIE] as string | undefined);
  res.clearCookie(ACCESS_COOKIE, accessCookieClearOptions());
  res.clearCookie(REFRESH_COOKIE, refreshCookieClearOptions());
  res.status(200).json({ success: true, data: { loggedOut: true } });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getUserById(currentUser(req).id);
  res.status(200).json({ success: true, data: { user } });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await passwordResetService.requestReset(req.body.email) });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await passwordResetService.performReset(req.body.token, req.body.password);
  res.status(200).json({ success: true, data: { reset: true } });
});

// ---------- users ----------

export const getProfile = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { user: await usersService.getProfile(currentUser(req).id) } });
});

export const updateProfile = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { user: await usersService.updateProfile(currentUser(req).id, req.body) } });
});

export const changePassword = asyncHandler(async (req, res) => {
  await usersService.changePassword(currentUser(req).id, req.body.currentPassword, req.body.newPassword);
  res.status(200).json({ success: true, data: { updated: true } });
});

// ---------- accounts ----------

export const listAccounts = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { accounts: await accountsService.listAccounts(currentUser(req).id) } });
});

export const createAccount = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { account: await accountsService.createAccount(currentUser(req).id, req.body) } });
});

export const getAccount = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { account: await accountsService.getAccountWithBalance(currentUser(req).id, paramId(req)) } });
});

export const updateAccount = asyncHandler(async (req, res) => {
  await accountsService.updateAccount(currentUser(req).id, paramId(req), req.body);
  res.status(200).json({ success: true, data: { updated: true } });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const reassignTo = typeof req.query.reassignTo === 'string' ? req.query.reassignTo : undefined;
  const result = await accountsService.deleteAccount(currentUser(req).id, paramId(req), reassignTo);
  res.status(200).json({ success: true, data: { deleted: true, ...result } });
});

// ---------- categories ----------

export const listCategories = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { categories: await categoriesService.listCategories(currentUser(req).id) } });
});

export const createCategory = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { category: await categoriesService.createCategory(currentUser(req).id, req.body) } });
});

export const updateCategory = asyncHandler(async (req, res) => {
  await categoriesService.updateCategory(currentUser(req).id, paramId(req), req.body);
  res.status(200).json({ success: true, data: { updated: true } });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await categoriesService.deleteCategory(currentUser(req).id, paramId(req));
  res.status(200).json({ success: true, data: { deleted: true } });
});

// ---------- transactions ----------

export const listTransactions = asyncHandler(async (req, res) => {
  const query = transactionQuerySchema.parse(req.query);
  res.status(200).json({ success: true, data: await transactionsService.listTransactions(currentUser(req).id, query) });
});

export const exportTransactions = asyncHandler(async (req, res) => {
  const query = transactionQuerySchema.parse(req.query);
  const rows = await transactionsService.listAllForExport(currentUser(req).id, query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="smart-finance-transactions.csv"');
  res.status(200).send(transactionsService.toCsv(rows));
});

export const createTransaction = asyncHandler(async (req, res) => {
  const { json, duplicate } = await transactionsService.createTransaction(currentUser(req).id, req.body);
  // A replayed offline submission returns the original transaction (200) instead
  // of creating a second one (201) — the client reconciles on this distinction.
  res.status(duplicate ? 200 : 201).json({ success: true, data: { transaction: json, duplicate } });
});

export const getTransaction = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { transaction: await transactionsService.getTransaction(currentUser(req).id, paramId(req)) } });
});

export const updateTransaction = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { transaction: await transactionsService.updateTransaction(currentUser(req).id, paramId(req), req.body) } });
});

export const deleteTransaction = asyncHandler(async (req, res) => {
  await transactionsService.deleteTransaction(currentUser(req).id, paramId(req));
  res.status(200).json({ success: true, data: { deleted: true } });
});

// ---------- budgets ----------

export const listBudgets = asyncHandler(async (req, res) => {
  const { month, year } = budgetQuerySchema.parse(req.query);
  res.status(200).json({ success: true, data: { budgets: await budgetsService.listBudgets(currentUser(req).id, currentUser(req).tz, month, year) } });
});

export const createBudget = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { budget: await budgetsService.createBudget(currentUser(req).id, req.body) } });
});

export const updateBudget = asyncHandler(async (req, res) => {
  await budgetsService.updateBudget(currentUser(req).id, paramId(req), req.body.limitPaise);
  res.status(200).json({ success: true, data: { updated: true } });
});

export const deleteBudget = asyncHandler(async (req, res) => {
  await budgetsService.deleteBudget(currentUser(req).id, paramId(req));
  res.status(200).json({ success: true, data: { deleted: true } });
});

// ---------- goals ----------

export const listGoals = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { goals: await goalsService.listGoals(currentUser(req).id) } });
});

export const createGoal = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { goal: await goalsService.createGoal(currentUser(req).id, req.body) } });
});

export const updateGoal = asyncHandler(async (req, res) => {
  await goalsService.updateGoal(currentUser(req).id, paramId(req), req.body);
  res.status(200).json({ success: true, data: { updated: true } });
});

export const deleteGoal = asyncHandler(async (req, res) => {
  await goalsService.deleteGoal(currentUser(req).id, paramId(req));
  res.status(200).json({ success: true, data: { deleted: true } });
});

export const addContribution = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await goalsService.addContribution(currentUser(req).id, paramId(req), req.body) });
});

export const listContributions = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { contributions: await goalsService.listContributions(currentUser(req).id, paramId(req)) } });
});

// ---------- dashboard ----------

export const dashboardSummary = asyncHandler(async (req, res) => {
  const { month, year } = dashboardQuerySchema.parse(req.query);
  res.status(200).json({ success: true, data: await dashboardService.dashboardSummary(currentUser(req).id, currentUser(req).tz, month, year) });
});

export const dashboardTrends = asyncHandler(async (req, res) => {
  const { months } = monthsQuerySchema.parse(req.query);
  res.status(200).json({ success: true, data: { series: await dashboardService.dashboardTrends(currentUser(req).id, currentUser(req).tz, months) } });
});

export const dashboardCategories = asyncHandler(async (req, res) => {
  const { month, year } = dashboardQuerySchema.parse(req.query);
  res.status(200).json({ success: true, data: { categories: await dashboardService.dashboardCategories(currentUser(req).id, currentUser(req).tz, month, year) } });
});

export const dashboardRecent = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { transactions: await dashboardService.dashboardRecent(currentUser(req).id) } });
});

// ---------- reports ----------

export const reportSummary = asyncHandler(async (req, res) => {
  const range = rangeQuerySchema.parse(req.query);
  res.status(200).json({ success: true, data: await reportsService.reportSummary(currentUser(req).id, currentUser(req).tz, range) });
});

export const reportMonthly = asyncHandler(async (req, res) => {
  const { months } = monthsQuerySchema.parse(req.query);
  res.status(200).json({ success: true, data: { series: await reportsService.monthlySeriesForMonths(currentUser(req).id, currentUser(req).tz, months) } });
});

export const reportCategories = asyncHandler(async (req, res) => {
  const range = rangeQuerySchema.parse(req.query);
  const summary = await reportsService.reportSummary(currentUser(req).id, currentUser(req).tz, range);
  res.status(200).json({ success: true, data: { categories: summary.byCategory } });
});

export const reportExport = asyncHandler(async (req, res) => {
  const range = rangeQuerySchema.parse(req.query);
  const query = transactionQuerySchema.parse({ ...range, sort: 'date_asc', pageSize: 100 });
  const rows = await transactionsService.listAllForExport(currentUser(req).id, query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="smart-finance-report.csv"');
  res.status(200).send(transactionsService.toCsv(rows));
});

// ---------- notifications ----------

export const listNotifications = asyncHandler(async (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  res.status(200).json({ success: true, data: await notificationsService.listNotifications(currentUser(req).id, unreadOnly) });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  await notificationsService.markRead(currentUser(req).id, paramId(req));
  res.status(200).json({ success: true, data: { updated: true } });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await notificationsService.markAllRead(currentUser(req).id);
  res.status(200).json({ success: true, data: { updated: true } });
});

export const clearNotification = asyncHandler(async (req, res) => {
  await notificationsService.clearNotification(currentUser(req).id, paramId(req));
  res.status(200).json({ success: true, data: { deleted: true } });
});

// ---------- recurring rules ----------

export const listRecurring = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { rules: await recurringService.listRecurring(currentUser(req).id) } });
});

export const createRecurring = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { rule: await recurringService.createRecurring(currentUser(req).id, req.body) } });
});

export const updateRecurring = asyncHandler(async (req, res) => {
  await recurringService.updateRecurring(currentUser(req).id, paramId(req), req.body);
  res.status(200).json({ success: true, data: { updated: true } });
});

export const deleteRecurring = asyncHandler(async (req, res) => {
  await recurringService.deleteRecurring(currentUser(req).id, paramId(req));
  res.status(200).json({ success: true, data: { deleted: true } });
});

export const runRecurringNow = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await recurringService.generateDueTransactions(currentUser(req).id) });
});

// ---------- insights ----------

export const spendingInsights = asyncHandler(async (req, res) => {
  const month = typeof req.query.month === 'string' ? req.query.month : undefined;
  res
    .status(200)
    .json({ success: true, data: { insights: await insightsService.spendingInsights(currentUser(req).id, currentUser(req).tz, currencyOf(currentUser(req)), month) } });
});

// ---------- assistant ----------

export const askAssistant = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: await assistantService.answerWithLlmIfConfigured(currentUser(req).id, currentUser(req).tz, currencyOf(currentUser(req)), req.body.question as string),
  });
});

const currencyOf = (user: AuthUser): string => user.currency;

// ---------- reports: typed views ----------

export const monthlyReport = asyncHandler(async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  res.status(200).json({
    success: true,
    data: await reportsService.monthlyReport(currentUser(req).id, currentUser(req).tz, currentUser(req).currency, year, month),
  });
});

export const monthlyReportPdf = asyncHandler(async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  const pdf = await reportsService.monthlyReportPdf(currentUser(req).id, currentUser(req).tz, currentUser(req).currency, year, month);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="smart-finance-${year}-${String(month).padStart(2, '0')}.pdf"`);
  res.status(200).send(pdf);
});

export const annualReport = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await reportsService.annualReport(currentUser(req).id, currentUser(req).tz, Number(req.params.year)) });
});

export const incomeReport = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await reportsService.typeReport(currentUser(req).id, currentUser(req).tz, Number(req.params.year), 'INCOME') });
});

export const expenseReport = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await reportsService.typeReport(currentUser(req).id, currentUser(req).tz, Number(req.params.year), 'EXPENSE') });
});

export const savingsReport = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await reportsService.savingsReport(currentUser(req).id, currentUser(req).tz, Number(req.params.year)) });
});
