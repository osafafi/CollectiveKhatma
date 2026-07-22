import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Button, MenuItem, Select, useTheme } from '@mui/material';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import { useThemeSettings } from '@/app/providers/themeSettingsContext';
import { retainedGlobalStyles } from '@/theme/globalStyles';
import { createKhatmaTheme } from '@/theme/muiTheme';
import { TOKENS } from '@/theme/tokens';

/** Emotion tags its injected `<style>` with `data-emotion="<key> <ids…>"`. */
function hasRtlCacheStyleTag(): boolean {
  return document.querySelector('style[data-emotion^="mui-rtl"]') !== null;
}

/** Surfaces the active mode and background so tests can observe theme swaps. */
function ModeProbe() {
  const theme = useTheme();
  const { mode, setMode } = useThemeSettings();
  return (
    <button
      data-mode={mode}
      data-palette-mode={theme.palette.mode}
      data-bg={theme.palette.background.default}
      onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
    >
      تبديل المظهر
    </button>
  );
}

describe('AppThemeProvider — RTL foundation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('forces the document direction and language to Arabic RTL', () => {
    render(
      <AppThemeProvider>
        <div>محتوى</div>
      </AppThemeProvider>,
    );

    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
  });

  it('routes styled components through the RTL Emotion cache', () => {
    render(
      <AppThemeProvider>
        <Button variant="contained">إجراء</Button>
      </AppThemeProvider>,
    );

    // The custom cache key prefixes every generated class name.
    const button = screen.getByRole('button', { name: 'إجراء' });
    expect(button.className).toMatch(/mui-rtl-/);
    expect(hasRtlCacheStyleTag()).toBe(true);
  });

  it('flips portalled components (Select menu) through the same RTL cache', () => {
    const { container } = render(
      <AppThemeProvider>
        <Select open value="1" onChange={() => {}}>
          <MenuItem value="1">الأول</MenuItem>
          <MenuItem value="2">الثاني</MenuItem>
        </Select>
      </AppThemeProvider>,
    );

    // The menu renders into a portal (document.body), not inside the app subtree.
    const listbox = screen.getByRole('listbox');
    expect(container).not.toContainElement(listbox);
    expect(document.body).toContainElement(listbox);

    // ...and it is still styled by the RTL cache, so portalled CSS is mirrored.
    expect(listbox.className).toMatch(/mui-rtl-/);
  });

  it('ships CssBaseline plus the retained global styles (fonts, reading scale, quran text)', () => {
    render(
      <AppThemeProvider>
        <div />
      </AppThemeProvider>,
    );
    // CssBaseline + GlobalStyles were injected via the RTL cache.
    expect(hasRtlCacheStyleTag()).toBe(true);

    // The retained layer defines the bundled Quran font, the UI/Quran font vars,
    // the scalable mushaf text class, and the redesign motion vocabulary.
    const styles = retainedGlobalStyles(createKhatmaTheme('light')) as unknown as Record<
      string,
      Record<string, string>
    > &
      Record<'@font-face', Array<Record<string, string>>>;
    // Both bundled Quran webfaces ship, in fallback order.
    expect(styles['@font-face'].map((face) => face.fontFamily)).toEqual([
      'Amiri Quran',
      'Scheherazade New',
    ]);
    expect(styles[':root']!['--font-ui']).toContain('Tajawal');
    expect(styles[':root']!['--font-quran']).toContain('Amiri Quran');
    expect(styles['.quran-text']!.fontFamily).toBe('var(--font-quran)');
    expect(styles['.quran-text']!.fontSize).toBe('calc(1.6rem * var(--reading-scale))');

    // Redesign additions: gold ayah markers, the four keyframes, and the
    // reduced-motion kill-switch.
    expect(styles['.ayah-marker']!.color).toBe(TOKENS.light.gold);
    for (const keyframe of ['fadeUp', 'shimmer', 'floaty', 'ringIn']) {
      expect(styles[`@keyframes ${keyframe}`]).toBeDefined();
    }
    expect(styles['@media (prefers-reduced-motion: reduce)']).toMatchObject({
      '*, *::before, *::after': { animation: 'none !important' },
    });
  });

  it('defaults to light, flips to dark via settings, and persists the choice', async () => {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta name="theme-color" content="#f6f1e7">',
    );
    const user = userEvent.setup();
    render(
      <AppThemeProvider>
        <ModeProbe />
      </AppThemeProvider>,
    );

    const probe = screen.getByRole('button', { name: 'تبديل المظهر' });
    expect(probe).toHaveAttribute('data-mode', 'light');
    expect(probe).toHaveAttribute('data-bg', TOKENS.light.bg);

    await user.click(probe);

    expect(probe).toHaveAttribute('data-mode', 'dark');
    expect(probe).toHaveAttribute('data-palette-mode', 'dark');
    expect(probe).toHaveAttribute('data-bg', TOKENS.dark.bg);
    expect(localStorage.getItem('khatma.themeMode')).toBe('dark');
    expect(
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    ).toBe(TOKENS.dark.bg);

    document.querySelector('meta[name="theme-color"]')?.remove();
  });
});
