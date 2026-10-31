import type { Currency } from '../types';

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amountMinor: number, currency: Currency, options?: { signed?: boolean }): string {
  const key = `${currency}:${options?.signed ? 's' : 'p'}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      signDisplay: options?.signed ? 'always' : 'auto',
    });
    currencyFormatters.set(key, formatter);
  }
  return formatter.format(amountMinor / 100);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function formatDate(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function monthLabel(month: string | Date = new Date()): string {
  const date = typeof month === 'string' ? new Date(`${month}-01T00:00:00.000Z`) : month;
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { from, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export function lastMonthsRange(n: number): { from: string; to: string } {
  const start = shiftMonth(currentMonthKey(), -(n - 1));
  return { from: `${start}-01`, to: toDayIso(new Date()) };
}

export function toDayIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function monthShort(key: string): string {
  const date = new Date(`${key}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(date);
}
