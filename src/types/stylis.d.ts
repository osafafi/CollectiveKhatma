/**
 * Minimal ambient types for `stylis` (RM-210).
 *
 * `stylis` 4.x ships no bundled type declarations and `@types/stylis` is not
 * installed. RM-210 imports only `prefixer` (for the RTL Emotion cache in
 * `src/theme/rtlCache.ts`), so this declares just that surface rather than
 * pulling a new devDependency + lockfile change into a theme task on a
 * non-pinned runtime. `stylis-plugin-rtl`'s own `.d.ts` references
 * `Middleware` from here too (it is otherwise tolerated via `skipLibCheck`).
 *
 * FOLLOW-UP (Lane A / RM-620 cleanup): if `@types/stylis` is later added, DELETE
 * this file — the two declarations would otherwise clash on `prefixer`.
 */
declare module 'stylis' {
  export interface Element {
    type: string;
    value: string;
    props: string | string[];
    children: string | Element[];
    root: Element | null;
    parent: Element | null;
    line: number;
    column: number;
    length: number;
    return: string;
  }

  export type Middleware = (
    element: Element,
    index: number,
    children: Element[],
    callback: Middleware,
  ) => string | void;

  export const prefixer: Middleware;
}
