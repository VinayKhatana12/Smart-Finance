import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import * as controller from '../controllers/v1.controller.js';
import { health } from '../controllers/health.controller.js';
import {
  createAccountSchema,
  createBudgetSchema,
  createCategorySchema,
  createContributionSchema,
  createGoalSchema,
  createTransactionSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  registerSchema,
  resetPasswordSchema,
  updateAccountSchema,
  updateBudgetSchema,
  updateCategorySchema,
  updateGoalSchema,
  updateTransactionSchema,
  createRecurringSchema,
  updateRecurringSchema,
  askSchema,
} from '../validation/v1.schema.js';

export const v1Router = Router();

v1Router.get('/health', health);

// ---------- auth ----------

const authRouter = Router();
authRouter.get('/csrf', controller.csrfToken);
authRouter.post('/register', validate(registerSchema), controller.register);
authRouter.post('/login', validate(loginSchema), controller.login);
authRouter.post('/logout', requireAuth, controller.logout);
authRouter.get('/me', requireAuth, controller.me);
authRouter.post('/refresh', controller.refresh); // the refresh cookie is its own credential
v1Router.use('/auth', authRouter);
v1Router.post('/auth/forgot', validate(forgotPasswordSchema), controller.forgotPassword);
v1Router.post('/auth/reset', validate(resetPasswordSchema), controller.resetPassword);

// ---------- users ----------

const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.get('/profile', controller.getProfile);
usersRouter.patch('/profile', validate(profileUpdateSchema), controller.updateProfile);
usersRouter.patch('/password', validate(passwordChangeSchema), controller.changePassword);
v1Router.use('/users', usersRouter);

// ---------- accounts ----------

const accountsRouter = Router();
accountsRouter.use(requireAuth);
accountsRouter.get('/', controller.listAccounts);
accountsRouter.post('/', validate(createAccountSchema), controller.createAccount);
accountsRouter.get('/:id', controller.getAccount);
accountsRouter.patch('/:id', validate(updateAccountSchema), controller.updateAccount);
accountsRouter.delete('/:id', controller.deleteAccount);
v1Router.use('/accounts', accountsRouter);

// ---------- categories ----------

const categoriesRouter = Router();
categoriesRouter.use(requireAuth);
categoriesRouter.get('/', controller.listCategories);
categoriesRouter.post('/', validate(createCategorySchema), controller.createCategory);
categoriesRouter.patch('/:id', validate(updateCategorySchema), controller.updateCategory);
categoriesRouter.delete('/:id', controller.deleteCategory);
v1Router.use('/categories', categoriesRouter);

// ---------- transactions ----------

const transactionsRouter = Router();
transactionsRouter.use(requireAuth);
transactionsRouter.get('/export', controller.exportTransactions);
transactionsRouter.get('/', controller.listTransactions);
transactionsRouter.post('/', validate(createTransactionSchema), controller.createTransaction);
transactionsRouter.get('/:id', controller.getTransaction);
transactionsRouter.patch('/:id', validate(updateTransactionSchema), controller.updateTransaction);
transactionsRouter.delete('/:id', controller.deleteTransaction);
v1Router.use('/transactions', transactionsRouter);

// ---------- budgets ----------

const budgetsRouter = Router();
budgetsRouter.use(requireAuth);
budgetsRouter.get('/', controller.listBudgets);
budgetsRouter.post('/', validate(createBudgetSchema), controller.createBudget);
budgetsRouter.patch('/:id', validate(updateBudgetSchema), controller.updateBudget);
budgetsRouter.delete('/:id', controller.deleteBudget);
v1Router.use('/budgets', budgetsRouter);

// ---------- savings goals ----------

const goalsRouter = Router();
goalsRouter.use(requireAuth);
goalsRouter.get('/', controller.listGoals);
goalsRouter.post('/', validate(createGoalSchema), controller.createGoal);
goalsRouter.patch('/:id', validate(updateGoalSchema), controller.updateGoal);
goalsRouter.delete('/:id', controller.deleteGoal);
goalsRouter.post('/:id/contributions', validate(createContributionSchema), controller.addContribution);
goalsRouter.get('/:id/contributions', controller.listContributions);
v1Router.use('/goals', goalsRouter);

// ---------- notifications ----------

const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get('/', controller.listNotifications);
notificationsRouter.post('/read-all', controller.markAllNotificationsRead);
notificationsRouter.post('/:id/read', controller.markNotificationRead);
notificationsRouter.delete('/:id', controller.clearNotification);
v1Router.use('/notifications', notificationsRouter);

// ---------- recurring rules ----------

const recurringRouter = Router();
recurringRouter.use(requireAuth);
recurringRouter.get('/', controller.listRecurring);
recurringRouter.post('/', validate(createRecurringSchema), controller.createRecurring);
recurringRouter.patch('/:id', validate(updateRecurringSchema), controller.updateRecurring);
recurringRouter.delete('/:id', controller.deleteRecurring);
recurringRouter.post('/run', controller.runRecurringNow);
v1Router.use('/recurring', recurringRouter);

// ---------- insights + assistant ----------

v1Router.get('/insights', requireAuth, controller.spendingInsights);
v1Router.post('/assistant/ask', requireAuth, validate(askSchema), controller.askAssistant);

// ---------- dashboard ----------

v1Router.get('/dashboard/summary', requireAuth, controller.dashboardSummary);
v1Router.get('/dashboard/trends', requireAuth, controller.dashboardTrends);
v1Router.get('/dashboard/categories', requireAuth, controller.dashboardCategories);
v1Router.get('/dashboard/recent-transactions', requireAuth, controller.dashboardRecent);

// ---------- reports ----------

v1Router.get('/reports/summary', requireAuth, controller.reportSummary);
v1Router.get('/reports/monthly', requireAuth, controller.reportMonthly);
v1Router.get('/reports/monthly/:year/:month', requireAuth, controller.monthlyReport);
v1Router.get('/reports/monthly/:year/:month/pdf', requireAuth, controller.monthlyReportPdf);
v1Router.get('/reports/annual/:year', requireAuth, controller.annualReport);
v1Router.get('/reports/income/:year', requireAuth, controller.incomeReport);
v1Router.get('/reports/expense/:year', requireAuth, controller.expenseReport);
v1Router.get('/reports/savings/:year', requireAuth, controller.savingsReport);
v1Router.get('/reports/categories', requireAuth, controller.reportCategories);
v1Router.get('/reports/export', requireAuth, controller.reportExport);
