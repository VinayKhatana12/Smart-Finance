export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'JPY';

export const CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY'];

export interface User {
  id: string;
  name: string;
  email: string;
  currency: Currency;
  timezone: string | null;
  createdAt: string;
}

export type AccountType = 'CASH' | 'BANK' | 'WALLET' | 'OTHER';

export interface Account {
  id: string;
  name: string;
  accountType: AccountType;
  openingBalancePaise: string; // BigInt leaves the API as strings
  balancePaise: string;
  currency: string;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string | null;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  icon: string;
  color: string;
  isSystem: boolean;
}

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export interface Transaction {
  id: string;
  accountId: string;
  accountName: string;
  transferAccountId: string | null;
  transferAccountName: string | null;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  type: TransactionType;
  amountPaise: string;
  amountDisplay: string;
  description: string;
  notes: string;
  transactionDate: string;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Budget {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  month: number;
  year: number;
  limitPaise: string;
  spentPaise: string;
  remainingPaise: string;
  percent: number;
}

export type GoalStatus = 'ACTIVE' | 'ACHIEVED' | 'ARCHIVED';

export interface Goal {
  id: string;
  title: string;
  targetPaise: string;
  savedPaise: string;
  remainingPaise: string;
  percent: number;
  deadline: string | null;
  status: GoalStatus;
  createdAt: string;
}

export interface Contribution {
  id: string;
  goalId: string;
  amountPaise: string;
  notes: string;
  contributionDate: string;
}

export interface FinancialAlert {
  severity: 'warning' | 'danger' | 'info';
  message: string;
}

export interface DashboardSummary {
  totalBalancePaise: string;
  incomePaise: string;
  expensePaise: string;
  netPaise: string;
  savingsRate: number | null;
  accounts: Array<{ id: string; name: string; accountType: AccountType; balancePaise: string }>;
  alerts: FinancialAlert[];
}

export interface MonthPoint {
  month: string;
  incomePaise: string;
  expensePaise: string;
}

export interface CategorySlice {
  categoryId: string;
  category: string;
  color: string;
  expensePaise: string;
  display?: string;
  incomePaise?: string;
}

export interface DashboardRecent {
  id: string;
  type: TransactionType;
  amountPaise: string;
  categoryId: string;
  categoryName: string;
  description: string;
  accountName: string;
  transferAccountName: string | null;
  transactionDate: string;
}

export interface ReportSummary {
  incomePaise: string;
  expensePaise: string;
  netPaise: string;
  savingsRate: number | null;
  byCategory: Array<CategorySlice & { incomePaise: string }>;
  byMonth: MonthPoint[];
}
