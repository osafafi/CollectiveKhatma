import type { Assignment } from './types';

export const MAX_DAILY_DUAS = 100;
export const MAX_DAILY_DUA_LENGTH = 12000;

/** Keep the entire list well below Firestore's document byte limit. */
export function validDailyDuas(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_DAILY_DUAS &&
    value.every(
      (text) =>
        typeof text === 'string' &&
        text.trim().length > 0 &&
        text.length <= MAX_DAILY_DUA_LENGTH,
    ) &&
    value.join('').length <= 100000
  );
}

/** Read ISO calendar dates without the member's timezone or completion clock. */
function dayNumber(date: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date)
    return undefined;
  return time / 86400000;
}

/** Earliest date in the round survives adjustments made on a later day. */
export function dailyDuaRoundDate(
  assignments: readonly Assignment[],
  round: number,
): string | undefined {
  return assignments
    .flatMap((assignment) => assignment.rounds)
    .filter((chunk) => chunk.round === round && dayNumber(chunk.date) !== undefined)
    .map((chunk) => chunk.date)
    .sort()[0];
}

/** Fixed epoch; day N advances one entry and wraps, including dates before epoch. */
export function dailyDuaForDate(
  duas: readonly string[],
  date: string | undefined,
): string | undefined {
  const day = date === undefined ? undefined : dayNumber(date);
  if (day === undefined || duas.length === 0) return undefined;
  const offset = day - Date.UTC(2026, 8, 7) / 86400000;
  return duas[((offset % duas.length) + duas.length) % duas.length];
}
