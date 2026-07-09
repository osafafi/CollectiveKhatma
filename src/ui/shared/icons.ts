/**
 * Inline-SVG icons for the tab bar. `dom.el` builds HTML elements only
 * (`createElement`), so SVG needs its own tiny helper (`createElementNS`).
 * Icons inherit color via `currentColor` and size via a Tailwind class, so the
 * nav controls their look with no per-icon styling.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export type IconName = 'quran' | 'khatmas' | 'personal' | 'settings';

/** Stroke paths per icon, drawn on a 24×24 viewBox. */
const PATHS: Record<IconName, string> = {
  // Open mushaf.
  quran:
    '<path d="M12 6.6C10.4 5.2 7.6 4.6 5 5.1v13c2.6-.5 5.4.1 7 1.5 1.6-1.4 4.4-2 7-1.5v-13c-2.6-.5-5.4.1-7 1.5Z"/><path d="M12 6.6V20"/>',
  // Two people (a group reading).
  khatmas:
    '<circle cx="9" cy="8" r="3.1"/><path d="M2.7 19.5c0-3.5 2.8-5.9 6.3-5.9s6.3 2.4 6.3 5.9"/><circle cx="17.4" cy="9" r="2.4"/><path d="M16.2 14.1c2.9.3 5.1 2.4 5.1 5.4"/>',
  // Single person.
  personal:
    '<circle cx="12" cy="8" r="3.5"/><path d="M4.8 20c0-3.9 3.2-6.4 7.2-6.4s7.2 2.5 7.2 6.4"/>',
  // Sliders (the reading font-size control lives here).
  settings:
    '<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 17h3"/><path d="M11 17h9"/><circle cx="9" cy="17" r="2"/>',
};

/** Build an SVG icon element. `className` sets its size/spacing (default h-6 w-6). */
export function icon(name: IconName, className = 'h-6 w-6'): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  svg.innerHTML = PATHS[name];
  return svg;
}
