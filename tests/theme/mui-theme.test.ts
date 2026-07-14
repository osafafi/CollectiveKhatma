import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appTheme, createAppTheme, tokens } from '@/theme/muiTheme';

/**
 * Extract the `--color-*` hex values from the `@theme` block of theme.css — the
 * still-legacy Tailwind palette. Through RM-450 the React palette was kept equal
 * to this copy (the R1 pattern). RM-460 refreshed the React palette under OD-03,
 * so the two now **intentionally diverge**: theme.css keeps the OLD palette (it
 * styles the legacy tree until RM-620), and muiTheme.ts carries the refreshed
 * one. This helper is now used to assert that divergence, not equality.
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

  it('applies the refreshed OD-03 palette onto the MUI palette (RM-460)', () => {
    // Pinned refreshed values — fresh, senior-friendly, reading-comfortable.
    // WCAG-AA contrast evidence is in docs/react-migration/tasks/RM-460.md.
    expect(appTheme.palette.background.default).toBe('#f6f1e7');
    expect(appTheme.palette.background.paper).toBe('#fffdf7');
    expect(appTheme.palette.text.primary).toBe('#26312b');
    expect(appTheme.palette.text.secondary).toBe('#5c6b62');
    expect(appTheme.palette.primary.main).toBe('#0e6f61');
    expect(appTheme.palette.primary.dark).toBe('#0a5348');
    expect(appTheme.palette.secondary.main).toBe('#c9a24a');
    expect(appTheme.palette.success.main).toBe('#2f7d55');
    expect(appTheme.palette.warning.main).toBe('#b45309');
    expect(appTheme.palette.error.main).toBe('#b23a2e');
    expect(appTheme.palette.divider).toBe('#e5ddcb');
  });

  it('pins the refreshed muiTheme tokens and splits accent from warn (R3)', () => {
    expect(tokens.color.bg).toBe('#f6f1e7');
    expect(tokens.color.surface).toBe('#fffdf7');
    expect(tokens.color.ink).toBe('#26312b');
    expect(tokens.color.muted).toBe('#5c6b62');
    expect(tokens.color.primary).toBe('#0e6f61');
    expect(tokens.color.primaryStrong).toBe('#0a5348');
    expect(tokens.color.accent).toBe('#c9a24a');
    expect(tokens.color.success).toBe('#2f7d55');
    expect(tokens.color.warn).toBe('#b45309');
    expect(tokens.color.danger).toBe('#b23a2e');
    expect(tokens.color.border).toBe('#e5ddcb');
    // Theme-map R3 resolved: the gold accent and the amber warn are now distinct.
    expect(tokens.color.accent).not.toBe(tokens.color.warn);
  });

  it('intentionally diverges from the legacy Tailwind palette (OD-03 refresh)', () => {
    // theme.css keeps the OLD palette (legacy tree until RM-620); the React
    // theme carries the refreshed one. Assert they DIFFER so neither copy is
    // silently synced back — this replaces the pre-RM-460 equality guard.
    const css = readThemeCssColors();
    expect(css.primary).toBe('#0f766e'); // legacy value, unchanged
    expect(Object.keys(css).length).toBeGreaterThanOrEqual(11);
    expect(appTheme.palette.primary.main).not.toBe(css.primary);
    expect(appTheme.palette.background.default).not.toBe(css.bg);
    expect(tokens.color.bg).not.toBe(css.bg);
    expect(tokens.color.primary).not.toBe(css.primary);
    expect(tokens.color.accent).not.toBe(css.accent);
  });

  it('sets white contrastText on filled semantics, dark ink on the gold accent', () => {
    expect(appTheme.palette.primary.contrastText).toBe('#ffffff');
    // Gold accent is light → dark ink text for legibility (RM-460).
    expect(appTheme.palette.secondary.contrastText).toBe('#26312b');
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
      borderRadius: 18,
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
