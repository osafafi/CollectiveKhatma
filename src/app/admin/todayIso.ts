/**
 * React-owned "today" as a local-calendar `YYYY-MM-DD` string — the value both
 * apps treat as today (inventory §1.6): it drives the admin same-day
 * distribution guard and the chunk date stamps.
 *
 * Deliberately a React-tree copy of the legacy `todayIso`
 * ([`src/ui/shared/components.ts`](../../ui/shared/components.ts)) rather than an
 * import: the React layer must not depend on the legacy `src/ui` layer, which is
 * removed at RM-620. Kept byte-for-byte equivalent so both apps agree on the
 * idempotency key during the transition.
 */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
