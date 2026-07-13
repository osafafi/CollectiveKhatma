/**
 * Tiny hash-based router used by the framework-free member app.
 *
 * The pure route contract now lives in `src/app/routing/routes.ts` so the
 * legacy and React surfaces cannot drift while the migration is in progress.
 * Window access remains isolated here for the legacy render loop.
 */

import { parseMemberRoute } from '@/app/routing/routes';

export {
  DEFAULT_MEMBER_ROUTE as DEFAULT_ROUTE,
  memberHash as hash,
  parseMemberRoute as parseRoute,
} from '@/app/routing/routes';
export type { MemberRoute as Route } from '@/app/routing/routes';

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

const memberRouter = createRouter(parseMemberRoute);

/** The current member route parsed from `window.location.hash`. */
export const currentRoute = memberRouter.current;

/** Subscribe to member route changes. Returns an unsubscribe function. */
export const onRouteChange = memberRouter.onChange;

/** Navigate by setting the hash (fires `hashchange`, which drives a re-render). */
export function navigate(target: string): void {
  window.location.hash = target;
}
