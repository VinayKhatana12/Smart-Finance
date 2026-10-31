import { z } from 'zod';

/** Integer paise: a positive safe integer, never a float, never a string with decimals. */
export const paiseAmount = z
  .number({ invalid_type_error: 'Enter an amount.' })
  .int('Amounts are whole paise (multiply the rupee figure by 100).')
  .positive('Enter an amount greater than zero.')
  .lte(Number.MAX_SAFE_INTEGER, 'That amount is too large.');

/** Opening balances may legitimately be negative, but stay safe integers. */
export const signedPaiseAmount = z
  .number({ invalid_type_error: 'Enter a balance.' })
  .int('Balances are whole paise.')
  .gte(-Number.MAX_SAFE_INTEGER, 'That value is too small.')
  .lte(Number.MAX_SAFE_INTEGER, 'That value is too large.');

const uuid = z.string().uuid();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker (YYYY-MM-DD).')
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

const monthInt = z.coerce.number().int().min(1).max(12);
const yearInt = z.coerce.number().int().min(2000).max(2200);

const categoryRef = uuid; // transactions and budgets point at category rows now

// ---------- auth ----------

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(128, 'Keep it under 128 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/[0-9]/, 'Include at least one number.'),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY']).default('INR'),
  timezone: z.string().trim().max(64).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80).optional(),
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY']).optional(),
    timezone: z.string().trim().max(64).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update.' });

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .max(128)
      .regex(/[A-Za-z]/, 'Include at least one letter.')
      .regex(/[0-9]/, 'Include at least one number.'),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'The new password must be different from the current one.',
    path: ['newPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'This reset link is invalid.'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(128)
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/[0-9]/, 'Include at least one number.'),
});

// ---------- accounts ----------

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, 'Give the account a name.').max(60),
  accountType: z.enum(['CASH', 'BANK', 'WALLET', 'OTHER']).default('BANK'),
  openingBalancePaise: signedPaiseAmount.default(0),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY']).default('INR'),
});

export const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    accountType: z.enum(['CASH', 'BANK', 'WALLET', 'OTHER']).optional(),
    openingBalancePaise: signedPaiseAmount.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update.' });

// ---------- categories ----------

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the category a name.')
    .max(40)
    .regex(/^[A-Za-z0-9 _-]+$/, 'Letters, numbers, spaces and dashes only.'),
  type: z.enum(['INCOME', 'EXPENSE']),
  icon: z.string().trim().max(24).default('tag'),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #1d5fd6.')
    .default('#5c6064'),
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9 _-]+$/).optional(),
    icon: z.string().trim().max(24).optional(),
    color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update.' });

// ---------- transactions ----------

const transferSchema = z
  .object({
    type: z.literal('TRANSFER'),
    accountId: uuid,
    transferAccountId: uuid,
    amountPaise: paiseAmount,
    description: z.string().trim().max(140).default(''),
    notes: z.string().trim().max(2000).default(''),
    transactionDate: isoDate,
    clientRequestId: uuid.optional(),
  })
  .refine((v) => v.accountId !== v.transferAccountId, {
    message: 'A transfer needs two different accounts.',
    path: ['transferAccountId'],
  });

const plainSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  accountId: uuid,
  transferAccountId: z.undefined().optional(),
  categoryId: categoryRef,
  amountPaise: paiseAmount,
  description: z.string().trim().max(140).default(''),
  notes: z.string().trim().max(2000).default(''),
  transactionDate: isoDate,
  clientRequestId: uuid.optional(),
});

/** A transaction is either a plain income/expense against a category, or a two-legged transfer. */
export const createTransactionSchema = z.union([transferSchema, plainSchema]);

export const updateTransactionSchema = z
  .object({
    accountId: uuid.optional(),
    transferAccountId: uuid.nullable().optional(),
    categoryId: uuid.optional(),
    type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
    amountPaise: paiseAmount.optional(),
    description: z.string().trim().max(140).optional(),
    notes: z.string().trim().max(2000).optional(),
    transactionDate: isoDate.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });

export const transactionQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  categoryId: uuid.optional(),
  accountId: uuid.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.enum(['date_desc', 'date_asc', 'amount_desc', 'amount_asc']).default('date_desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------- budgets ----------

export const createBudgetSchema = z.object({
  categoryId: categoryRef,
  month: monthInt,
  year: yearInt,
  limitPaise: paiseAmount,
});

export const updateBudgetSchema = z.object({ limitPaise: paiseAmount });

export const budgetQuerySchema = z.object({ month: monthInt, year: yearInt });

export const monthYearQuerySchema = budgetQuerySchema;

export const rangeQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((v) => v.from <= v.to, { message: 'The end date is before the start date.' });

export const monthsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});

// ---------- goals ----------

export const createGoalSchema = z.object({
  title: z.string().trim().min(1, 'Give the goal a title.').max(80),
  targetPaise: paiseAmount,
  deadline: z.union([isoDate, z.null()]).optional(),
});

export const updateGoalSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    targetPaise: paiseAmount.optional(),
    deadline: z.union([isoDate, z.null()]).optional(),
    status: z.enum(['ACTIVE', 'ACHIEVED', 'ARCHIVED']).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update.' });

export const createContributionSchema = z.object({
  amountPaise: paiseAmount,
  contributionDate: isoDate.optional(),
  notes: z.string().trim().max(200).default(''),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type CreateContributionInput = z.infer<typeof createContributionSchema>;
export type RangeQuery = z.infer<typeof rangeQuerySchema>;

// ---------- recurring rules ----------

const recurrenceFrequency = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

export const createRecurringSchema = z
  .object({
    accountId: uuid,
    categoryId: categoryRef,
    type: z.enum(['INCOME', 'EXPENSE']),
    title: z.string().trim().min(1, 'Give the rule a title.').max(80),
    amountPaise: paiseAmount,
    frequency: recurrenceFrequency,
    startDate: isoDate,
    endDate: z.union([isoDate, z.null()]).optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: 'The end date is before the start date.',
    path: ['endDate'],
  });

export const updateRecurringSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    amountPaise: paiseAmount.optional(),
    active: z.boolean().optional(),
    endDate: z.union([isoDate, z.null()]).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update.' });

// ---------- assistant ----------

export const askSchema = z.object({
  question: z.string().trim().min(3, 'Ask a question.').max(300, 'Keep it under 300 characters.'),
});
