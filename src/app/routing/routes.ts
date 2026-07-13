/**
 * Shared hash-route contracts for the legacy and React applications.
 *
 * Keep parsing pure and total: GitHub Pages serves a static entry, so route
 * selection happens entirely after the hash and an unknown URL renders the
 * surface's established default without rewriting browser history.
 */

export type MemberRoute =
  | { name: 'khatmas' }
  | { name: 'khatma'; id: string }
  | { name: 'khatmaRead'; id: string }
  | { name: 'quran'; page?: number }
  | { name: 'personal' }
  | { name: 'settings' };

export type AdminRoute =
  | { name: 'home' }
  | { name: 'roster' }
  | { name: 'khatmas' }
  | { name: 'khatma'; id: string }
  | { name: 'settings' };

export const DEFAULT_MEMBER_ROUTE: MemberRoute = { name: 'khatmas' };
export const DEFAULT_ADMIN_ROUTE: AdminRoute = { name: 'home' };

function routeParts(hashOrPath: string): string[] {
  const path = hashOrPath.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  return path === '' ? [] : path.split('/');
}

/** Parse the established member hashes, including their legacy fallbacks. */
export function parseMemberRoute(hashOrPath: string): MemberRoute {
  const [head, second, third] = routeParts(hashOrPath);

  switch (head) {
    case undefined:
    case 'khatmas':
      return { name: 'khatmas' };
    case 'quran': {
      const page = second !== undefined ? Number(second) : NaN;
      return Number.isInteger(page) ? { name: 'quran', page } : { name: 'quran' };
    }
    case 'khatma':
      if (!second) return DEFAULT_MEMBER_ROUTE;
      return third === 'read'
        ? { name: 'khatmaRead', id: second }
        : { name: 'khatma', id: second };
    case 'personal':
      return { name: 'personal' };
    case 'settings':
      return { name: 'settings' };
    default:
      return DEFAULT_MEMBER_ROUTE;
  }
}

/** Parse the established admin hashes, including their legacy fallbacks. */
export function parseAdminRoute(hashOrPath: string): AdminRoute {
  const [head, second] = routeParts(hashOrPath);

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

/** Path builders used by React Router. */
export const memberPath = {
  khatmas: (): string => '/khatmas',
  khatma: (id: string): string => `/khatma/${id}`,
  khatmaRead: (id: string): string => `/khatma/${id}/read`,
  quran: (page?: number): string => (page ? `/quran/${page}` : '/quran'),
  personal: (): string => '/personal',
  settings: (): string => '/settings',
} as const;

export const adminPath = {
  home: (): string => '/home',
  roster: (): string => '/roster',
  khatmas: (): string => '/khatmas',
  khatma: (id: string): string => `/khatmas/${id}`,
  settings: (): string => '/settings',
} as const;

/** Convert a typed route into a React Router destination. */
export function memberRoutePath(route: MemberRoute): string {
  switch (route.name) {
    case 'khatmas':
      return memberPath.khatmas();
    case 'khatma':
      return memberPath.khatma(route.id);
    case 'khatmaRead':
      return memberPath.khatmaRead(route.id);
    case 'quran':
      return memberPath.quran(route.page);
    case 'personal':
      return memberPath.personal();
    case 'settings':
      return memberPath.settings();
  }
}

export function adminRoutePath(route: AdminRoute): string {
  switch (route.name) {
    case 'home':
      return adminPath.home();
    case 'roster':
      return adminPath.roster();
    case 'khatmas':
      return adminPath.khatmas();
    case 'khatma':
      return adminPath.khatma(route.id);
    case 'settings':
      return adminPath.settings();
  }
}

const toHash = (path: string): string => `#${path}`;

/** Compatibility builders for existing native hash links. */
export const memberHash = {
  khatmas: (): string => toHash(memberPath.khatmas()),
  khatma: (id: string): string => toHash(memberPath.khatma(id)),
  khatmaRead: (id: string): string => toHash(memberPath.khatmaRead(id)),
  quran: (page?: number): string => toHash(memberPath.quran(page)),
  personal: (): string => toHash(memberPath.personal()),
  settings: (): string => toHash(memberPath.settings()),
} as const;

export const adminHash = {
  home: (): string => toHash(adminPath.home()),
  roster: (): string => toHash(adminPath.roster()),
  khatmas: (): string => toHash(adminPath.khatmas()),
  khatma: (id: string): string => toHash(adminPath.khatma(id)),
  settings: (): string => toHash(adminPath.settings()),
} as const;
