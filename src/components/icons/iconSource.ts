/**
 * Icon source URLs + the file-based override system (RM-330) — the React twin of
 * the legacy [`src/ui/shared/icons.ts`](../../ui/shared/icons.ts).
 *
 * Icons load from `public/icons/` so the admin can swap them for downloaded
 * artwork without touching code: replace `icons/<name>.svg`, or drop an
 * `icons/<name>.png` beside it — the PNG wins when present (probed once at
 * startup by {@link resolveIconOverrides}). Only the image's alpha channel
 * matters: the `.icon-mask` span paints it with `currentColor`.
 *
 * The legacy tree kept the chosen URLs in a mutated Map and relied on the nav
 * re-rendering on every route/data change to pick an override up. React renders
 * are not tied to routes that way, so this module is a tiny external store:
 * components read through `useIconUrl`, and a late-arriving override notifies
 * subscribers and re-renders exactly the icons that changed.
 *
 * URLs are built from Vite's BASE_URL (same pattern as the Quran loader) so
 * they resolve under the GitHub Pages base path in production.
 */

export type IconName = 'quran' | 'khatmas' | 'personal' | 'settings' | 'home';

export const ICON_NAMES: readonly IconName[] = [
  'quran',
  'khatmas',
  'personal',
  'settings',
  'home',
];

function iconUrl(name: IconName, ext: 'svg' | 'png'): string {
  const base = import.meta.env.BASE_URL;
  return `${base.endsWith('/') ? base : `${base}/`}icons/${name}.${ext}`;
}

function defaultUrls(): Readonly<Record<IconName, string>> {
  return Object.fromEntries(
    ICON_NAMES.map((name) => [name, iconUrl(name, 'svg')]),
  ) as Record<IconName, string>;
}

/** name -> chosen URL. Replaced (never mutated) so snapshots stay comparable. */
let urls: Readonly<Record<IconName, string>> = defaultUrls();
let probeStarted = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** The currently chosen URL for an icon (the .svg until a probe upgrades it). */
export function getIconUrl(name: IconName): string {
  return urls[name];
}

/** Subscribe to override upgrades (the `useSyncExternalStore` contract). */
export function subscribeToIconUrls(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * One-shot startup probe: if `icons/<name>.png` exists it overrides the SVG.
 * Runs in the background — subscribed components re-render when an override
 * lands, so it appears after at most a brief default-icon flash. Idempotent:
 * repeated calls (or a re-evaluated entry module) never re-probe.
 *
 * A 200 alone is not proof the PNG exists: Vite's dev server answers missing
 * paths probed with fetch's wildcard Accept header via the SPA HTML fallback
 * (200 `text/html`), which would flip every mask onto an HTML document and
 * blank the icons. Requiring an image content-type keeps the probe truthful
 * in dev and is a no-op on static production hosting, where a missing PNG is
 * a real 404. (The legacy probe trusts `ok` and has this dev-only defect.)
 *
 * `fetchImpl` exists for tests; production callers pass nothing.
 */
export function resolveIconOverrides(fetchImpl?: typeof fetch): void {
  if (probeStarted) return;
  probeStarted = true;
  const probe: typeof fetch = fetchImpl ?? ((input, init) => fetch(input, init));
  for (const name of ICON_NAMES) {
    const png = iconUrl(name, 'png');
    void probe(png, { method: 'HEAD' })
      .then((res) => {
        const type = res.headers.get('content-type') ?? '';
        if (res.ok && type.startsWith('image/')) {
          urls = { ...urls, [name]: png };
          emit();
        }
      })
      .catch(() => undefined);
  }
}

/** Test-only: forget overrides and let the probe run again. */
export function resetIconOverridesForTests(): void {
  urls = defaultUrls();
  probeStarted = false;
  listeners.clear();
}
