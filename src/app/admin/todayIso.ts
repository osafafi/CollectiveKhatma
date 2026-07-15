/**
 * React-owned "today" as a local-calendar `YYYY-MM-DD` string — the value both
 * apps treat as today (inventory §1.6): it drives the admin same-day
 * distribution guard and the chunk date stamps.
 *
 * Kept as the single application source so pages and tests share one clock and
 * distribution-idempotency contract.
 */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
