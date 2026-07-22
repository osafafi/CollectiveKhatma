import { describe, expect, it } from 'vitest';
import { alpha } from '@mui/material/styles';
import { createKhatmaTheme } from '@/theme/muiTheme';
import { retainedGlobalStyles } from '@/theme/globalStyles';
import { TOKENS, cardGradient, primaryBtnGradient, type ThemeMode } from '@/theme/tokens';

type Rgb = readonly [number, number, number];

function rgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16),
  ) as unknown as Rgb;
}

function relativeLuminance(color: Rgb): number {
  const [red, green, blue] = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function composite(foreground: Rgb, background: Rgb, alphaChannel: number): Rgb {
  return foreground.map((channel, index) =>
    Math.round(channel * alphaChannel + background[index]! * (1 - alphaChannel)),
  ) as unknown as Rgb;
}

const MODES: readonly ThemeMode[] = ['light', 'dark'];

describe('MUI theme — token mapping', () => {
  it('is right-to-left in both modes', () => {
    for (const mode of MODES) {
      expect(createKhatmaTheme(mode).direction).toBe('rtl');
    }
  });

  it('pins the light palette (unchanged from the pre-redesign refresh)', () => {
    const theme = createKhatmaTheme('light');
    expect(theme.palette.mode).toBe('light');
    expect(theme.palette.background.default).toBe('#f6f1e7');
    expect(theme.palette.background.paper).toBe('#fffdf7');
    expect(theme.palette.text.primary).toBe('#26312b');
    expect(theme.palette.text.secondary).toBe('#5c6b62');
    expect(theme.palette.primary.main).toBe('#0e6f61');
    expect(theme.palette.primary.dark).toBe('#0a5348');
    expect(theme.palette.secondary.main).toBe('#c9a24a');
    expect(theme.palette.success.main).toBe('#2f7d55');
    expect(theme.palette.warning.main).toBe('#b45309');
    expect(theme.palette.error.main).toBe('#b23a2e');
    expect(theme.palette.divider).toBe('#e5ddcb');
  });

  it('pins the dark palette onto the dark token map', () => {
    const theme = createKhatmaTheme('dark');
    expect(theme.palette.mode).toBe('dark');
    expect(theme.palette.background.default).toBe(TOKENS.dark.bg);
    expect(theme.palette.background.paper).toBe(TOKENS.dark.surface);
    expect(theme.palette.text.primary).toBe(TOKENS.dark.ink);
    expect(theme.palette.text.secondary).toBe(TOKENS.dark.muted);
    expect(theme.palette.primary.main).toBe(TOKENS.dark.emerald);
    expect(theme.palette.primary.dark).toBe(TOKENS.dark.emerald2);
    expect(theme.palette.secondary.main).toBe(TOKENS.dark.gold);
    expect(theme.palette.error.main).toBe(TOKENS.dark.danger);
    expect(theme.palette.divider).toBe(TOKENS.dark.border);
  });

  it('keeps the gold accent distinct from the warning amber in both modes', () => {
    for (const mode of MODES) {
      expect(TOKENS[mode].gold).not.toBe(TOKENS[mode].warn);
    }
  });

  it('gives filled semantics legible contrast text per mode', () => {
    const light = createKhatmaTheme('light');
    expect(light.palette.primary.contrastText).toBe('#ffffff');
    // Gold accent is light → dark ink text for legibility.
    expect(light.palette.secondary.contrastText).toBe('#26312b');
    expect(light.palette.success.contrastText).toBe('#ffffff');
    expect(light.palette.error.contrastText).toBe('#ffffff');

    // Dark-mode fills are bright, so they carry the near-black onEmerald ink.
    const dark = createKhatmaTheme('dark');
    for (const semantic of [
      'primary',
      'secondary',
      'success',
      'warning',
      'error',
    ] as const) {
      expect(dark.palette[semantic].contrastText).toBe(TOKENS.dark.onEmerald);
    }
  });

  it.each(MODES)('keeps %s text, statuses, and focus above WCAG floors', (mode) => {
    const t = TOKENS[mode];
    const backgrounds = [rgb(t.bg), rgb(t.surface)];
    const normalTextColors = [rgb(t.ink), rgb(t.muted), rgb(t.emerald), rgb(t.danger)];

    for (const background of backgrounds) {
      for (const foreground of normalTextColors) {
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
      for (const statusColor of [rgb(t.successStrong), rgb(t.warnStrong)]) {
        const tintedBackground = composite(statusColor, background, 0.1);
        expect(contrastRatio(statusColor, tintedBackground)).toBeGreaterThanOrEqual(4.5);
      }

      const focusRing = composite(rgb(t.emerald), background, 0.7);
      expect(contrastRatio(focusRing, background)).toBeGreaterThanOrEqual(3);
    }

    // Redesign pairings: button text on the primary fill, chip text on the
    // gold-soft surface.
    expect(contrastRatio(rgb(t.onEmerald), rgb(t.emerald))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(rgb(t.goldInk), rgb(t.goldSoft))).toBeGreaterThanOrEqual(4.5);
  });

  it('derives the focus ring from the mode primary in the retained globals', () => {
    for (const mode of MODES) {
      const theme = createKhatmaTheme(mode);
      const styles = retainedGlobalStyles(theme) as unknown as Record<
        string,
        Record<string, string>
      >;
      expect(styles[':focus-visible']!.outline).toBe(
        `3px solid ${alpha(TOKENS[mode].emerald, 0.7)}`,
      );
      expect(styles[':root']!.colorScheme).toBe(mode);
    }
  });

  it('uses the app 4px spacing unit', () => {
    const theme = createKhatmaTheme('light');
    expect(theme.spacing(2)).toBe('8px');
    expect(theme.spacing(4)).toBe('16px');
    expect(theme.spacing(28)).toBe('112px');
  });

  it('uses the app responsive breakpoints', () => {
    const theme = createKhatmaTheme('light');
    expect(theme.breakpoints.values.md).toBe(768);
    expect(theme.breakpoints.values.lg).toBe(1024);
    expect(theme.breakpoints.values.xs).toBe(0);
    expect(theme.breakpoints.values.sm).toBe(640);
    expect(theme.breakpoints.values.xl).toBe(1280);
  });

  it('uses the redesign button radius as the common shape radius', () => {
    expect(createKhatmaTheme('light').shape.borderRadius).toBe(14);
  });

  it('uses the app UI font stack and type scale with the display weight', () => {
    const theme = createKhatmaTheme('light');
    expect(theme.typography.fontFamily).toBe('var(--font-ui)');
    expect(theme.typography.fontWeightMedium).toBe(500);
    expect(theme.typography.fontWeightBold).toBe(700);
    expect(theme.typography.h1.fontSize).toBe('1.875rem');
    expect(theme.typography.h1.fontWeight).toBe(800);
    expect(theme.typography.h2.fontSize).toBe('1.5rem');
    expect(theme.typography.body1.fontSize).toBe('1rem');
    expect(theme.typography.caption.fontSize).toBe('0.75rem');
  });

  it('exposes the redesign token bag on theme.custom', () => {
    for (const mode of MODES) {
      const theme = createKhatmaTheme(mode);
      const t = TOKENS[mode];
      expect(theme.custom.gold).toBe(t.gold);
      expect(theme.custom.goldSoft).toBe(t.goldSoft);
      expect(theme.custom.goldInk).toBe(t.goldInk);
      expect(theme.custom.heroGrad).toBe(t.heroGrad);
      expect(theme.custom.heroInk).toBe(t.heroInk);
      expect(theme.custom.cellRem).toBe(t.cellRem);
      expect(theme.custom.tabActiveBg).toBe(t.tabActiveBg);
      expect(theme.custom.tabActiveInk).toBe(t.tabActiveInk);
      expect(theme.custom.tabIdle).toBe(t.tabIdle);
      expect(theme.custom.readerBg).toBe(t.readerBg);
      expect(theme.custom.cardShadow).toBe(t.cardShadow);
      expect(theme.custom.btnShadow).toBe(t.btnShadow);
      expect(theme.custom.primaryBtnGradient).toBe(primaryBtnGradient(mode));
      expect(theme.custom.cardBg).toBe(cardGradient(mode, 'subtle', 160));
      expect(theme.custom.radii.card).toBe(20);
      expect(theme.custom.radii.tabPill).toBe(16);
      expect(theme.custom.motion.base).toBe('0.5s');
    }
  });

  it('feeds card-gradient factory options into theme.custom.cardBg', () => {
    const bold = createKhatmaTheme('light', { cardStrength: 'bold', cardAngle: 90 });
    expect(bold.custom.cardBg).toBe(cardGradient('light', 'bold', 90));

    const none = createKhatmaTheme('dark', { cardStrength: 'none' });
    expect(none.custom.cardBg).toBe(TOKENS.dark.surface);
  });

  it('resolves card gradients from strength and angle parameters', () => {
    // Strength none collapses to the solid surface (no gradient string).
    expect(cardGradient('light', 'none')).toBe(TOKENS.light.surface);
    expect(cardGradient('dark', 'none')).toBe(TOKENS.dark.surface);
    // Subtle/bold interpolate the angle into a two-stop gradient.
    expect(cardGradient('light', 'subtle', 160)).toContain('linear-gradient(160deg');
    expect(cardGradient('light', 'bold', 200)).toContain('linear-gradient(200deg');
    expect(cardGradient('dark')).toContain('linear-gradient(160deg');
  });

  it('builds independent theme instances per call', () => {
    const first = createKhatmaTheme('light');
    const second = createKhatmaTheme('light');
    expect(first).not.toBe(second);
    expect(second.palette.primary.main).toBe(first.palette.primary.main);
  });

  it('centralizes shared component defaults', () => {
    const theme = createKhatmaTheme('light');
    const t = TOKENS.light;
    expect(theme.components?.MuiButton?.defaultProps).toMatchObject({
      disableElevation: true,
    });
    expect(theme.components?.MuiButton?.styleOverrides?.root).toMatchObject({
      textTransform: 'none',
      fontWeight: 700,
      minHeight: 44,
    });
    expect(theme.components?.MuiButton?.styleOverrides?.sizeLarge).toMatchObject({
      minHeight: 56,
    });
    // The primary CTA gradient rides on the contained+primary variant.
    expect(theme.components?.MuiButton?.variants?.[0]).toMatchObject({
      props: { variant: 'contained', color: 'primary' },
      style: {
        background: primaryBtnGradient('light'),
        boxShadow: t.btnShadow,
      },
    });
    expect(theme.components?.MuiCard?.styleOverrides?.root).toMatchObject({
      borderRadius: 20,
      borderColor: t.border,
      backgroundColor: t.surface,
      backgroundImage: cardGradient('light', 'subtle', 160),
      boxShadow: t.cardShadow,
    });
    // The dark elevation overlay must never lighten Paper surfaces.
    expect(theme.components?.MuiPaper?.styleOverrides?.root).toMatchObject({
      backgroundImage: 'none',
    });
    expect(theme.components?.MuiChip?.styleOverrides?.root).toMatchObject({
      borderRadius: 10,
    });
    expect(theme.components?.MuiLinearProgress?.styleOverrides?.root).toMatchObject({
      height: 8,
      backgroundColor: t.cellRem,
    });
    expect(theme.components?.MuiOutlinedInput?.styleOverrides?.root).toMatchObject({
      backgroundColor: t.bg,
    });
  });
});
