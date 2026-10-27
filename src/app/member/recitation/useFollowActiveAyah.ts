import { useEffect, useRef } from 'react';

/** After the member scrolls by hand, the reader stops following for this long. */
export const FOLLOW_BACK_OFF_MS = 4000;

/** Keys that scroll the page; any of them counts as scrolling by hand. */
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

/** Viewport edges the dock and the sticky chrome cover, in px. */
const TOP_MARGIN = 80;
const BOTTOM_MARGIN = 200;

/**
 * Keep the recited ayah in view: when it moves outside the comfortable middle
 * of the viewport, scroll it to the centre — unless the member scrolled the
 * page themselves in the last few seconds. Smooth unless they asked for
 * reduced motion (the CSS kill-switch does not reach script scrolling).
 */
export function useFollowActiveAyah(activeKey: string | undefined, ready: boolean): void {
  const manualScrollAt = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    const mark = (): void => {
      manualScrollAt.current = Date.now();
    };
    const markKey = (event: KeyboardEvent): void => {
      if (SCROLL_KEYS.has(event.key)) mark();
    };
    const options = { passive: true } as const;
    window.addEventListener('wheel', mark, options);
    window.addEventListener('touchmove', mark, options);
    window.addEventListener('keydown', markKey);
    return () => {
      window.removeEventListener('wheel', mark);
      window.removeEventListener('touchmove', mark);
      window.removeEventListener('keydown', markKey);
    };
  }, []);

  useEffect(() => {
    if (!activeKey || !ready) return;
    if (Date.now() - manualScrollAt.current < FOLLOW_BACK_OFF_MS) return;
    const element = document.querySelector<HTMLElement>(selectorFor(activeKey));
    if (!element || typeof element.scrollIntoView !== 'function') return;
    const rect = element.getBoundingClientRect();
    if (rect.top >= TOP_MARGIN && rect.bottom <= window.innerHeight - BOTTOM_MARGIN)
      return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }, [activeKey, ready]);
}

function selectorFor(key: string): string {
  return key.startsWith('b:')
    ? `[data-basmala="${key.slice(2)}"]`
    : `[data-ayah="${key}"]`;
}
