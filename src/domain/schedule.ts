/**
 * Pure khatma-timing helpers (REQUIREMENTS §6, §8). Everything is derived from
 * ISO date strings (YYYY-MM-DD) computed in UTC, so there are no timezone/DST
 * drifts and the functions stay deterministic and unit-testable — the caller
 * passes "today" (the UI reads the real clock at the edge).
 *
 * A khatma spans day indices `[0 .. durationDays - 1]`; index 0 is `startDate`.
 */

const MS_PER_DAY = 86_400_000;

/** UTC-midnight epoch (ms) for a YYYY-MM-DD string. */
function toUtcMs(iso: string): number {
  const parts = iso.split('-');
  return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

/** Whole days from `startDate` to `date` (negative if `date` is earlier). */
export function daysBetween(startDate: string, date: string): number {
  return Math.round((toUtcMs(date) - toUtcMs(startDate)) / MS_PER_DAY);
}

/** The YYYY-MM-DD `days` after `startDate` (negative `days` goes earlier). */
export function addDays(startDate: string, days: number): string {
  return new Date(toUtcMs(startDate) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Zero-based day index of `today` within a khatma that began on `startDate`:
 * 0 on the start date, negative before it, `>= durationDays` once it has ended.
 */
export function currentDayIndex(startDate: string, today: string): number {
  return daysBetween(startDate, today);
}

/** The last reading day (inclusive): `startDate + (durationDays - 1)`. */
export function lastDay(startDate: string, durationDays: number): string {
  return addDays(startDate, durationDays - 1);
}

/** True while `today` falls within `[startDate, lastDay]` inclusive. */
export function isWithinKhatma(startDate: string, durationDays: number, today: string): boolean {
  const index = currentDayIndex(startDate, today);
  return index >= 0 && index < durationDays;
}

/**
 * Reading days left counting today (`durationDays - currentDayIndex`), clamped
 * to `[0, durationDays]`: `durationDays` on/before the start, 1 on the last day,
 * 0 once ended.
 */
export function daysRemaining(startDate: string, durationDays: number, today: string): number {
  const remaining = durationDays - currentDayIndex(startDate, today);
  return Math.max(0, Math.min(durationDays, remaining));
}

/**
 * Urgency flag for the admin dashboard (REQUIREMENTS §8): the khatma is still
 * running and within its final `threshold` days (default 2 — "last day or two").
 */
export function isFinalStretch(
  startDate: string,
  durationDays: number,
  today: string,
  threshold = 2,
): boolean {
  const remaining = daysRemaining(startDate, durationDays, today);
  return remaining > 0 && remaining <= threshold;
}
