/**
 * Settings popout — currently the reading font-size control (REQUIREMENTS §6, a
 * priority feature for the senior audience). Rendering/wiring only; the scale
 * mechanism itself lives in the theme layer (src/theme/reading.ts).
 *
 * Uses a native <details> popover so open/close state and accessibility come for
 * free without a framework. Shared so both the member and admin apps can offer
 * the same control.
 */
import { strings } from '@/content/strings.ar';
import { getReadingScale, setReadingScale, type ReadingScale } from '@/theme/reading';
import { el } from './dom';

/** A self-contained settings button that expands to the font-size slider. */
export function settingsControl(): HTMLElement {
  const sample = el('p', { class: 'quran-text mt-3 text-center' }, [strings.settings.sample]);

  const slider = el('input', {
    type: 'range',
    min: '1',
    max: '5',
    step: '1',
    value: String(getReadingScale()),
    class: 'w-full accent-primary',
    'aria-label': strings.settings.fontSize,
  }) as HTMLInputElement;

  // Live-apply on drag so the sample text (and the whole app) resize immediately.
  slider.addEventListener('input', () => {
    setReadingScale(Number(slider.value) as ReadingScale);
  });

  return el('details', { class: 'rounded-card border border-border bg-surface' }, [
    el(
      'summary',
      {
        class: 'cursor-pointer list-none px-4 py-3 text-lg font-semibold text-primary select-none',
      },
      [`⚙ ${strings.settings.title}`],
    ),
    el('div', { class: 'border-t border-border p-4' }, [
      el('label', { class: 'mb-2 block text-muted' }, [strings.settings.fontSize]),
      slider,
      sample,
    ]),
  ]);
}
