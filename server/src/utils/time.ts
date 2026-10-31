/**
 * Month boundaries in the user's own timezone.
 *
 * A "month" is only well-defined relative to a clock: 1 October in Asia/Kolkata
 * starts six and a half hours before 1 October UTC. Every month-scoped query
 * (budget spending, dashboard, monthly reports) goes through these helpers.
 */

/** Offset from UTC of `timeZone` at the given instant, in milliseconds. */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - date.getTime();
}

/** The UTC instants between which the civil month falls inside `timeZone`. */
export function monthRangeInTz(year: number, month: number, timeZone: string): { start: Date; end: Date } {
  const naiveStart = Date.UTC(year, month - 1, 1);
  const naiveEnd = Date.UTC(year, month, 1);
  // The offset at the boundary instant is what matters (DST shifts can differ
  // mid-month, so re-measure once from the corrected instant).
  let start = new Date(naiveStart - timeZoneOffsetMs(new Date(naiveStart), timeZone));
  start = new Date(naiveStart - timeZoneOffsetMs(start, timeZone));
  let end = new Date(naiveEnd - timeZoneOffsetMs(new Date(naiveEnd), timeZone));
  end = new Date(naiveEnd - timeZoneOffsetMs(end, timeZone));
  return { start, end };
}

/** 'YYYY-MM' string helpers for the month+year integer pair. */
export const monthKey = (year: number, month: number): string => `${year}-${String(month).padStart(2, '0')}`;

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`Invalid month key: ${key}`);
  return { year: y, month: m };
}

export function shiftMonthKey(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

export const DEFAULT_TZ = 'UTC';

export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

export function currentMonthKey(): string {
  const now = new Date();
  return monthKey(now.getFullYear(), now.getMonth() + 1);
}

export function shiftMonth(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/** The current month key in the given timezone (defaults to the server clock's UTC month). */
export function currentMonthKeyInTz(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  return `${y}-${m}`;
}
