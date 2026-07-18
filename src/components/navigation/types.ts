import type { IconName } from '@/components/icons';

/**
 * One navigation destination in the responsive shell.
 *
 * Generic over the app's typed route union (`MemberRoute` / `AdminRoute`) so the
 * member and admin apps each supply their own data-driven tab list without the
 * shared layout knowing their route shapes.
 */
export interface ShellTab<R> {
  /** Icon file base name under `public/icons/` (see {@link NavIcon}). */
  readonly iconName: IconName;
  /** Arabic label, sourced from `strings.ar.ts` (no hardcoded copy). */
  readonly label: string;
  /** Typed destination this tab links to. */
  readonly to: R;
  /** Whether this tab owns the current route (a tab may own nested routes). */
  readonly isActive: (route: R) => boolean;
}
