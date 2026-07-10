/**
 * Tiny hand-rolled SVG charts for the admin Home tab (REQUIREMENTS §8) — no
 * chart library, per the project's framework-free/single-dependency rule.
 * Colors come from the theme tokens (`var(--color-…)`) so a theme edit restyles
 * the charts too. Identity is never color-alone: every visual pairs with text.
 */
import { toArabicDigits } from '@/content/quran/symbols';
import { el } from '@/ui/shared/dom';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

/**
 * A donut showing one completion percentage, with the value as a hero number
 * in the middle (the single source of identity is the accompanying title, so
 * no legend is needed). Track = border token, fill = primary token.
 */
export function donutChart(percent: number, size = 112): HTMLElement {
  const clamped = Math.max(0, Math.min(100, percent));
  const stroke = 10;
  const r = 48 - stroke / 2 - 2; // viewBox is 96x96; keep the ring inside
  const circumference = 2 * Math.PI * r;

  const svg = svgEl('svg', {
    viewBox: '0 0 96 96',
    width: String(size),
    height: String(size),
    role: 'img',
    'aria-label': `${clamped}%`,
  });
  const track = svgEl('circle', {
    cx: '48',
    cy: '48',
    r: String(r),
    fill: 'none',
    stroke: 'var(--color-border)',
    'stroke-width': String(stroke),
  });
  const fill = svgEl('circle', {
    cx: '48',
    cy: '48',
    r: String(r),
    fill: 'none',
    stroke: 'var(--color-primary)',
    'stroke-width': String(stroke),
    'stroke-linecap': 'round',
    'stroke-dasharray': `${(circumference * clamped) / 100} ${circumference}`,
    // Start at 12 o'clock and grow clockwise (SVG circles start at 3 o'clock).
    transform: 'rotate(-90 48 48)',
  });
  if (clamped > 0) svg.append(track, fill);
  else svg.append(track);

  const label = el('span', { class: 'absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums' }, [
    `${toArabicDigits(clamped)}٪`,
  ]);
  const wrap = el('div', { class: 'relative inline-block' }, [label]);
  wrap.prepend(svg);
  return wrap;
}

export interface BarSegment {
  value: number;
  /** A theme token, e.g. 'var(--color-primary)'. */
  color: string;
  label: string;
}

/**
 * A single horizontal breakdown bar (e.g. read / being-read / remaining pages)
 * with 2px surface gaps between fills and a text legend below — counts are
 * written out, so color is reinforcement, not the only signal.
 */
export function segmentBar(segments: BarSegment[]): HTMLElement {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);

  const bar = el('div', { class: 'flex h-3 w-full gap-[2px] overflow-hidden rounded-button' });
  if (total === 0 || visible.length === 0) {
    bar.append(el('div', { class: 'h-3 w-full rounded-button bg-border' }));
  } else {
    for (const s of visible) {
      const seg = el('div', { class: 'h-3' });
      seg.style.backgroundColor = s.color;
      seg.style.flexGrow = String(s.value);
      seg.style.flexBasis = '0';
      bar.append(seg);
    }
  }

  const legend = el(
    'div',
    { class: 'flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted' },
    segments.map((s) => {
      const dot = el('span', { class: 'inline-block h-2 w-2 rounded-full align-middle' });
      dot.style.backgroundColor = s.color;
      return el('span', { class: 'inline-flex items-center gap-1' }, [
        dot,
        `${s.label}: ${toArabicDigits(s.value)}`,
      ]);
    }),
  );

  return el('div', { class: 'space-y-1' }, [bar, legend]);
}
