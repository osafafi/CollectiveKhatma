import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appTheme, createAppTheme, tokens } from '@/theme/muiTheme';

/**
 * Extract the `--color-*` hex values from the `@theme` block of theme.css — the
 * still-legacy Tailwind copy of the palette. RM-210 keeps a second copy in
 * muiTheme.ts; this parses the source so the parity test below fails loudly if
 * the two ever drift before RM-620 removes the Tailwind copy.
 */
function readThemeCssColors(): Record<string, string> {
  const css = readFileSync(
    resolve(import.meta.dirname, '../../src/theme/theme.css'),
    'utf8',
  );
  const colors: Record<string, string> = {};
  for (const match of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    colors[match[1]!] = match[2]!.toLowerCase();
  }
  return colors;
}

describe('MUI theme — token mapping (RM-210)', () => {
  it('is right-to-left', () => {
    expect(appTheme.direction).toBe('rtl');
  });

  it('maps every theme.css color token onto the palette', () => {
    const css = readThemeCssColors();

    // Sanity: the parse actually found the @theme colors.
    expect(css.primary).toBe('#0f766e');
    expect(Object.keys(css).length).toBeGreaterThanOrEqual(11);

    expect(appTheme.palette.background.default).toBe(css.bg);
    expect(appTheme.palette.background.paper).toBe(css.surface);
    expect(appTheme.palette.text.primary).toBe(css.ink);
    expect(appTheme.palette.text.secondary).toBe(css.muted);
    expect(appTheme.palette.primary.main).toBe(css.primary);
    expect(appTheme.palette.primary.dark).toBe(css['primary-strong']);
    expect(appTheme.palette.secondary.main).toBe(css.accent);
    expect(appTheme.palette.success.main).toBe(css.success);
    expect(appTheme.palette.warning.main).toBe(css.warn);
    expect(appTheme.palette.error.main).toBe(css.danger);
    expect(appTheme.palette.divider).toBe(css.border);
  });

  it('keeps the muiTheme tokens in sync with theme.css', () => {
    const css = readThemeCssColors();
    expect(tokens.color.bg).toBe(css.bg);
    expect(tokens.color.surface).toBe(css.surface);
    expect(tokens.color.ink).toBe(css.ink);
    expect(tokens.color.muted).toBe(css.muted);
    expect(tokens.color.primary).toBe(css.primary);
    expect(tokens.color.primaryStrong).toBe(css['primary-strong']);
    expect(tokens.color.accent).toBe(css.accent);
    expect(tokens.color.success).toBe(css.success);
    expect(tokens.color.warn).toBe(css.warn);
    expect(tokens.color.danger).toBe(css.danger);
    expect(tokens.color.border).toBe(css.border);
  });

  it('sets white contrastText on filled semantic colors', () => {
    expect(appTheme.palette.primary.contrastText).toBe('#ffffff');
    expect(appTheme.palette.secondary.contrastText).toBe('#ffffff');
    expect(appTheme.palette.success.contrastText).toBe('#ffffff');
    expect(appTheme.palette.warning.contrastText).toBe('#ffffff');
    expect(appTheme.palette.error.contrastText).toBe('#ffffff');
  });

  it('reconciles the 4px spacing unit (Tailwind parity, not MUI default 8px)', () => {
    expect(appTheme.spacing(2)).toBe('8px'); // gap-2
    expect(appTheme.spacing(4)).toBe('16px'); // p-4
    expect(appTheme.spacing(28)).toBe('112px'); // pb-28 (tab-bar clearance)
  });

  it('overrides breakpoints to the Tailwind pixel values the app uses', () => {
    expect(appTheme.breakpoints.values.md).toBe(768);
    expect(appTheme.breakpoints.values.lg).toBe(1024);
    expect(appTheme.breakpoints.values.xs).toBe(0);
    expect(appTheme.breakpoints.values.sm).toBe(640);
    expect(appTheme.breakpoints.values.xl).toBe(1280);
  });

  it('uses the button radius as the common shape radius', () => {
    expect(appTheme.shape.borderRadius).toBe(12);
  });

  it('keeps the legacy UI font stack via the CSS variable and maps the type scale', () => {
    expect(appTheme.typography.fontFamily).toBe('var(--font-ui)');
    expect(appTheme.typography.fontWeightMedium).toBe(500);
    expect(appTheme.typography.fontWeightBold).toBe(700);
    expect(appTheme.typography.h1.fontSize).toBe('1.875rem');
    expect(appTheme.typography.h2.fontSize).toBe('1.5rem');
    expect(appTheme.typography.body1.fontSize).toBe('1rem');
    expect(appTheme.typography.caption.fontSize).toBe('0.75rem');
  });

  it('exposes a factory that builds an independent theme instance', () => {
    const fresh = createAppTheme();
    expect(fresh).not.toBe(appTheme);
    expect(fresh.direction).toBe('rtl');
    expect(fresh.palette.primary.main).toBe(appTheme.palette.primary.main);
  });

  it('centralizes RM-320 component parity defaults', () => {
    expect(appTheme.components?.MuiButton?.defaultProps).toMatchObject({
      disableElevation: true,
    });
    expect(appTheme.components?.MuiButton?.styleOverrides?.root).toMatchObject({
      textTransform: 'none',
      fontWeight: 600,
    });
    expect(appTheme.components?.MuiButton?.styleOverrides?.sizeLarge).toMatchObject({
      minHeight: 56,
    });
    expect(appTheme.components?.MuiCard?.styleOverrides?.root).toMatchObject({
      borderRadius: 16,
      borderColor: tokens.color.border,
    });
    expect(appTheme.components?.MuiChip?.styleOverrides?.root).toMatchObject({
      borderRadius: 12,
    });
    expect(appTheme.components?.MuiLinearProgress?.styleOverrides?.root).toMatchObject({
      height: 8,
      backgroundColor: tokens.color.border,
    });
    expect(appTheme.components?.MuiOutlinedInput?.styleOverrides?.root).toMatchObject({
      backgroundColor: tokens.color.bg,
    });
  });
});
