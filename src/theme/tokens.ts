/**
 * خَتْمة design tokens — single source of truth for the redesign.
 *
 * Sourced from the Claude Design handoff ("Khatma app polish and design
 * direction"); the light map intentionally matches the pre-redesign palette.
 * Components read these through the MUI theme (`createKhatmaTheme` →
 * `palette` / `theme.custom`) only — no literal colors, radii, shadows, or
 * timings belong in component code. Change a token here → the whole app
 * updates in both modes.
 */

export type ThemeMode = 'light' | 'dark';
export type GradientStrength = 'none' | 'subtle' | 'bold';

export interface ColorTokens {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  border: string;
  emerald: string;
  emerald2: string;
  gold: string;
  goldSoft: string;
  goldInk: string;
  heroInk: string;
  onEmerald: string;
  cellRem: string;
  tabActiveBg: string;
  tabActiveInk: string;
  tabIdle: string;
  danger: string;
  success: string;
  successStrong: string;
  warn: string;
  warnStrong: string;
  readerBg: string;
  medalCenter: string;
  surahBandInk: string;
  heroGrad: string;
  heroGlow: string;
  heroPill: string;
  heroPillBorder: string;
  heroShimmer: string;
  cardShadow: string;
  btnShadow: string;
}

export const TOKENS: Record<ThemeMode, ColorTokens> = {
  light: {
    bg: '#f6f1e7',
    surface: '#fffdf7',
    ink: '#26312b',
    muted: '#5c6b62',
    border: '#e5ddcb',
    emerald: '#0e6f61',
    emerald2: '#0a5348',
    gold: '#c9a24a',
    goldSoft: '#f4ead0',
    goldInk: '#8a6a1f',
    heroInk: '#eafaf4',
    onEmerald: '#ffffff',
    cellRem: '#e5ddcb',
    tabActiveBg: 'rgba(14,111,97,.13)',
    tabActiveInk: '#0a5348',
    tabIdle: '#94a199',
    danger: '#c0492f',
    success: '#2f7d55',
    successStrong: '#256444',
    warn: '#b45309',
    warnStrong: '#904207',
    readerBg: '#f1ead9',
    medalCenter: '#fff9ec',
    surahBandInk: '#fdf3d8',
    heroGrad: 'linear-gradient(140deg,#0e6f61 0%,#0a5348 60%,#08463c 100%)',
    heroGlow:
      'radial-gradient(120% 90% at 88% -12%, rgba(201,162,74,.32), transparent 55%)',
    heroPill: 'rgba(255,255,255,.16)',
    heroPillBorder: 'rgba(255,255,255,.22)',
    heroShimmer: 'rgba(255,255,255,.2)',
    cardShadow: '0 12px 32px rgba(38,49,43,.10), 0 2px 6px rgba(38,49,43,.05)',
    btnShadow: '0 8px 20px rgba(14,111,97,.28)',
  },
  dark: {
    bg: '#0e1613',
    surface: '#16211c',
    ink: '#eef3ef',
    muted: '#9db0a5',
    border: '#26332c',
    emerald: '#37b89f',
    emerald2: '#1f8f7b',
    gold: '#d9b45f',
    goldSoft: '#2a2415',
    goldInk: '#e6c877',
    heroInk: '#eafaf4',
    onEmerald: '#052019',
    cellRem: '#2a3a32',
    tabActiveBg: 'rgba(55,184,159,.18)',
    tabActiveInk: '#4fd0b6',
    tabIdle: '#728579',
    danger: '#e8836b',
    success: '#5cbf8f',
    successStrong: '#7fd2a8',
    warn: '#e0a050',
    warnStrong: '#f0bc74',
    readerBg: '#0e1613',
    medalCenter: '#0f1c17',
    surahBandInk: '#fbeecb',
    heroGrad: 'linear-gradient(140deg,#155448 0%,#0c342c 60%,#08251f 100%)',
    heroGlow:
      'radial-gradient(120% 90% at 88% -12%, rgba(217,180,95,.28), transparent 55%)',
    heroPill: 'rgba(255,255,255,.12)',
    heroPillBorder: 'rgba(255,255,255,.18)',
    heroShimmer: 'rgba(255,255,255,.15)',
    cardShadow: '0 14px 36px rgba(0,0,0,.5)',
    btnShadow: '0 8px 22px rgba(55,184,159,.3)',
  },
};

export const RADII = {
  phone: 38,
  hero: 28,
  card: 20,
  cardSm: 16,
  button: 14,
  pill: 10,
  tabPill: 16,
} as const;

/**
 * Font stacks mirror the `--font-ui` / `--font-quran` CSS variables in
 * `globalStyles.ts` — the redesign keeps the existing fonts (no Cairo).
 */
export const FONTS = {
  ui: "'Tajawal', system-ui, -apple-system, 'Segoe UI', sans-serif",
  quran: "'Amiri Quran', 'Scheherazade New', 'serif'",
} as const;

/** Reading-scale multipliers driven by data-reading-scale on <html>. */
export const READING_SCALE = [0.9, 1, 1.15, 1.3, 1.5] as const;

export const MOTION = {
  fast: '0.25s',
  base: '0.5s',
  slow: '0.8s',
  easing: 'cubic-bezier(.2,.7,.3,1)',
} as const;

/** Card gradient — derived from user params, never hardcoded per component. */
const CARD_STOPS: Record<GradientStrength, Record<ThemeMode, [string, string]>> = {
  none: { light: ['#fffdf7', '#fffdf7'], dark: ['#16211c', '#16211c'] },
  subtle: { light: ['#fffef9', '#f3ead9'], dark: ['#1a2620', '#131c17'] },
  bold: { light: ['#fffef9', '#ecdfc8'], dark: ['#1f2d25', '#0f1712'] },
};

export function cardGradient(
  mode: ThemeMode,
  strength: GradientStrength = 'subtle',
  angle = 160,
): string {
  const [a, b] = CARD_STOPS[strength][mode];
  return a === b ? a : `linear-gradient(${angle}deg, ${a} 0%, ${b} 100%)`;
}

export const primaryBtnGradient = (mode: ThemeMode): string =>
  `linear-gradient(135deg, ${TOKENS[mode].emerald}, ${TOKENS[mode].emerald2})`;
