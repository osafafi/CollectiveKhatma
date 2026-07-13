/**
 * Compatibility exports for the framework-free admin app.
 *
 * The shared route contract lives under `src/app/routing` so both migration
 * surfaces preserve the same URLs and fallback behavior.
 */

export { adminHash, DEFAULT_ADMIN_ROUTE, parseAdminRoute } from '@/app/routing/routes';
export type { AdminRoute } from '@/app/routing/routes';
