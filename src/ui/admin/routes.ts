/**
 * Admin app routes (REQUIREMENTS §8): four tabs — Home (metrics + distribute),
 * Roster, Khatmas (list + per-khatma management pages), Settings — over the
 * shared hash router (`createRouter` in `src/ui/shared/router.ts`).
 */

export type AdminRoute =
  | { name: 'home' }
  | { name: 'roster' }
  | { name: 'khatmas' }
  | { name: 'khatma'; id: string }
  | { name: 'settings' };

/** The default route when the hash is empty or unrecognized. */
export const DEFAULT_ADMIN_ROUTE: AdminRoute = { name: 'home' };

/**
 * Parse a location hash (e.g. `#/khatmas/abc`) into a typed AdminRoute. Pure
 * and total: anything unrecognized falls back to {@link DEFAULT_ADMIN_ROUTE}.
 */
export function parseAdminRoute(hash: string): AdminRoute {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  const parts = path === '' ? [] : path.split('/');
  const [head, second] = parts;

  switch (head) {
    case undefined:
    case 'home':
      return { name: 'home' };
    case 'roster':
      return { name: 'roster' };
    case 'khatmas':
      return second ? { name: 'khatma', id: second } : { name: 'khatmas' };
    case 'settings':
      return { name: 'settings' };
    default:
      return DEFAULT_ADMIN_ROUTE;
  }
}

/** Typed hash builders — components link/navigate through these, never raw strings. */
export const adminHash = {
  home: (): string => '#/home',
  roster: (): string => '#/roster',
  khatmas: (): string => '#/khatmas',
  khatma: (id: string): string => `#/khatmas/${id}`,
  settings: (): string => '#/settings',
} as const;
