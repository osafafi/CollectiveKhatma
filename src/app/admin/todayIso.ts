/**
 * React-owned "today" as a local-calendar `YYYY-MM-DD` string — the value both
 * apps treat as today (current UI contract): it drives the admin same-day
 * distribution guard and the chunk date stamps.
 *
 * Kept as the single application source so pages and tests share one clock and
 * distribution-idempotency contract.
 */
export { localDateIso as todayIso } from '@/domain/wird';
