import type { Khatma, WirdCompletion } from './types';

/** Legacy documents have no kind and remain ordinary khatmas. */
export function isWird(series: Pick<Khatma, 'kind'>): boolean {
  return series.kind === 'wird';
}

export function isKhatma(series: Pick<Khatma, 'kind'>): boolean {
  return !isWird(series);
}

/** Local-calendar date used by the daily Wird availability contract. */
export function localDateIso(date: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function wirdCompletedOn(
  completions: readonly WirdCompletion[],
  memberId: string,
  date: string,
): boolean {
  return completions.some(
    (completion) => completion.memberId === memberId && completion.date === date,
  );
}

export function memberBelongsToWird(
  wird: Pick<Khatma, 'memberIds' | 'pastMemberIds'>,
  memberId: string,
): boolean {
  return (
    wird.memberIds.includes(memberId) || wird.pastMemberIds?.includes(memberId) === true
  );
}
