/**
 * Tab-bar icons, loaded from `public/icons/` so the admin can swap them for
 * downloaded artwork without touching code:
 *
 *   - Replace `public/icons/<name>.svg`, or drop a `<name>.png` beside it —
 *     the PNG wins when present (probed once at startup).
 *   - Icons render as a CSS-mask `<span>` painted with `currentColor`, so any
 *     monochrome SVG or PNG-with-transparency automatically takes the active
 *     tab color. Only the image's alpha channel matters, not its colors.
 *
 * URLs are built from Vite's BASE_URL (same pattern as the Quran loader) so
 * they resolve under the GitHub Pages base path in production.
 */

export type IconName = 'quran' | 'khatmas' | 'personal' | 'settings' | 'home';

const NAMES: IconName[] = ['quran', 'khatmas', 'personal', 'settings', 'home'];

function iconUrl(name: IconName, ext: 'svg' | 'png'): string {
  const base = import.meta.env.BASE_URL;
  return `${base.endsWith('/') ? base : `${base}/`}icons/${name}.${ext}`;
}

/** name -> chosen URL. Defaults to the .svg; the probe upgrades to .png. */
const urls = new Map<IconName, string>(NAMES.map((n) => [n, iconUrl(n, 'svg')]));

/**
 * One-shot startup probe: if `icons/<name>.png` exists it overrides the SVG.
 * Runs in the background — the nav re-renders on every route/data change, so
 * an override appears after at most a brief default-icon flash.
 */
export function resolveIconOverrides(): void {
  for (const name of NAMES) {
    const png = iconUrl(name, 'png');
    void fetch(png, { method: 'HEAD' })
      .then((res) => {
        if (res.ok) urls.set(name, png);
      })
      .catch(() => undefined);
  }
}

/** Build an icon element. `className` sets its size/spacing (default h-6 w-6). */
export function icon(name: IconName, className = 'h-6 w-6'): HTMLElement {
  const span = document.createElement('span');
  span.setAttribute('aria-hidden', 'true');
  span.className = `icon-mask ${className}`;
  const url = `url("${urls.get(name) ?? iconUrl(name, 'svg')}")`;
  span.style.setProperty('mask-image', url);
  span.style.setProperty('-webkit-mask-image', url);
  return span;
}
