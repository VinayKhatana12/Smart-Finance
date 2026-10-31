import { z } from 'zod';

const CURRENCY_VALUES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY'] as const;
const currencySchema = z.enum(CURRENCY_VALUES);

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80, 'Keep it under 80 characters.'),
  email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(128, 'Keep it under 128 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/[0-9]/, 'Include at least one number.'),
  currency: currencySchema,
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80, 'Keep it under 80 characters.'),
  currency: currencySchema,
});

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;
