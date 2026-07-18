import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, MenuItem, Select } from '@mui/material';
import { AppThemeProvider } from '@/app/providers/AppThemeProvider';
import { retainedGlobalStyles } from '@/theme/globalStyles';

/** Emotion tags its injected `<style>` with `data-emotion="<key> <ids…>"`. */
function hasRtlCacheStyleTag(): boolean {
  return document.querySelector('style[data-emotion^="mui-rtl"]') !== null;
}

describe('AppThemeProvider — RTL foundation', () => {
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
    // and the scalable mushaf text class.
    const styles = retainedGlobalStyles as Record<string, Record<string, string>> &
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
  });
});
