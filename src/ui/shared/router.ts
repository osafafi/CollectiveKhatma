/**
 * Tiny hash-based router. Hash routing — not the History API — is a deliberate
 * choice: the app is a static site (GitHub Pages) with no server to rewrite
 * unknown paths, and it composes with Vite's `base` without extra config.
 *
 * `createRouter` is generic so each app defines its own route union + pure
 * parser (member: this file's `parseRoute`; admin: `src/ui/admin/routes.ts`).
 * Parsers are pure string→Route functions (unit-tested); everything that
 * touches `window` is a thin wrapper around them.
 */

/** Wrap a pure hash parser with the window plumbing (current route + changes). */
export function createRouter<R>(parse: (hash: string) => R): {
  current: () => R;
  onChange: (callback: (route: R) => void) => () => void;
} {
  return {
    current: () => parse(window.location.hash),
    onChange: (callback) => {
      const handler = (): void => callback(parse(window.location.hash));
      window.addEventListener('hashchange', handler);
      return () => window.removeEventListener('hashchange', handler);
    },
  };
}

export type Route =
  | { name: 'khatmas' }
  | { name: 'khatma'; id: string }
  | { name: 'khatmaRead'; id: string }
  | { name: 'quran'; page?: number }
  | { name: 'personal' }
  | { name: 'settings' };

/** The default route when the hash is empty or unrecognized. */
export const DEFAULT_ROUTE: Route = { name: 'khatmas' };

/**
 * Parse a location hash (e.g. `#/khatma/abc/read`) into a typed Route. Pure and
 * total: anything unrecognized falls back to {@link DEFAULT_ROUTE}.
 */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  const parts = path === '' ? [] : path.split('/');
  const [head, second, third] = parts;

  switch (head) {
    case undefined:
    case 'khatmas':
      return { name: 'khatmas' };
    case 'quran': {
      const page = second !== undefined ? Number(second) : NaN;
      return Number.isInteger(page) ? { name: 'quran', page } : { name: 'quran' };
    }
    case 'khatma':
      if (!second) return DEFAULT_ROUTE;
      return third === 'read' ? { name: 'khatmaRead', id: second } : { name: 'khatma', id: second };
    case 'personal':
      return { name: 'personal' };
    case 'settings':
      return { name: 'settings' };
    default:
      return DEFAULT_ROUTE;
  }
}

/** Typed hash builders — components link/navigate through these, never raw strings. */
export const hash = {
  khatmas: (): string => '#/khatmas',
  khatma: (id: string): string => `#/khatma/${id}`,
  khatmaRead: (id: string): string => `#/khatma/${id}/read`,
  quran: (page?: number): string => (page ? `#/quran/${page}` : '#/quran'),
  personal: (): string => '#/personal',
  settings: (): string => '#/settings',
} as const;

const memberRouter = createRouter(parseRoute);

/** The current member route parsed from `window.location.hash`. */
export const currentRoute = memberRouter.current;

/** Subscribe to member route changes. Returns an unsubscribe function. */
export const onRouteChange = memberRouter.onChange;

/** Navigate by setting the hash (fires `hashchange`, which drives a re-render). */
export function navigate(target: string): void {
  window.location.hash = target;
}
