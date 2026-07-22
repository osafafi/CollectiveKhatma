import { createTheme, type Theme } from '@mui/material/styles';
import {
  MOTION,
  RADII,
  TOKENS,
  cardGradient,
  primaryBtnGradient,
  type GradientStrength,
  type ThemeMode,
} from '@/theme/tokens';

/**
 * Centralized MUI theme for the Arabic RTL member and admin apps.
 *
 * Built per mode by {@link createKhatmaTheme} from the redesign token maps in
 * `tokens.ts` (light values match the pre-redesign palette; WCAG-AA contrast
 * for both modes is guarded by the theme tests). Non-palette design tokens ride
 * along in `theme.custom` so shared components can style from the theme alone —
 * never from app state and never from literals.
 */

/** Non-palette redesign tokens exposed to components via `theme.custom`. */
export interface CustomThemeTokens {
  gold: string;
  goldSoft: string;
  goldInk: string;
  heroInk: string;
  onEmerald: string;
  cellRem: string;
  tabActiveBg: string;
  tabActiveInk: string;
  tabIdle: string;
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
  /** Resolved card background — a gradient string, or a solid color for strength "none". */
  cardBg: string;
  primaryBtnGradient: string;
  radii: typeof RADII;
  motion: typeof MOTION;
}

declare module '@mui/material/styles' {
  interface Theme {
    custom: CustomThemeTokens;
  }
  interface ThemeOptions {
    custom?: CustomThemeTokens;
  }
}

export interface KhatmaThemeOptions {
  /** Card-gradient strength; a runtime parameter, defaults to the design's "subtle". */
  cardStrength?: GradientStrength;
  /** Card-gradient angle in degrees; defaults to the design's 160. */
  cardAngle?: number;
}

/**
 * Build the app theme for one mode. Exported as a factory so the provider can
 * rebuild on theme-mode changes and tests can construct fresh instances.
 */
export function createKhatmaTheme(
  mode: ThemeMode = 'light',
  opts: KhatmaThemeOptions = {},
): Theme {
  const t = TOKENS[mode];

  const custom: CustomThemeTokens = {
    gold: t.gold,
    goldSoft: t.goldSoft,
    goldInk: t.goldInk,
    heroInk: t.heroInk,
    onEmerald: t.onEmerald,
    cellRem: t.cellRem,
    tabActiveBg: t.tabActiveBg,
    tabActiveInk: t.tabActiveInk,
    tabIdle: t.tabIdle,
    readerBg: t.readerBg,
    medalCenter: t.medalCenter,
    surahBandInk: t.surahBandInk,
    heroGrad: t.heroGrad,
    heroGlow: t.heroGlow,
    heroPill: t.heroPill,
    heroPillBorder: t.heroPillBorder,
    heroShimmer: t.heroShimmer,
    cardShadow: t.cardShadow,
    btnShadow: t.btnShadow,
    cardBg: cardGradient(mode, opts.cardStrength ?? 'subtle', opts.cardAngle ?? 160),
    primaryBtnGradient: primaryBtnGradient(mode),
    radii: RADII,
    motion: MOTION,
  };

  return createTheme({
    // RTL is the app's only direction (Arabic). Pairs with the stylis RTL
    // Emotion cache in rtlCache.ts and `dir="rtl"` set by AppThemeProvider.
    direction: 'rtl',

    custom,

    palette: {
      // `mode` alone makes MUI internals (dialogs, menus, hover/disabled
      // overlays, form controls) resolve dark-correct defaults.
      mode,
      primary: {
        main: t.emerald,
        dark: t.emerald2,
        contrastText: t.onEmerald,
      },
      // Gold accent surfaces carry dark ink text in light mode (the accent is
      // bright); in dark mode the near-black onEmerald keeps it legible on the
      // still-bright gold.
      secondary: {
        main: t.gold,
        contrastText: mode === 'light' ? t.ink : t.onEmerald,
      },
      success: {
        main: t.success,
        dark: t.successStrong,
        contrastText: t.onEmerald,
      },
      // Warning amber remains distinct from the lighter gold accent.
      warning: {
        main: t.warn,
        dark: t.warnStrong,
        contrastText: t.onEmerald,
      },
      error: { main: t.danger, contrastText: t.onEmerald },
      background: {
        default: t.bg,
        paper: t.surface,
      },
      text: {
        primary: t.ink,
        secondary: t.muted,
      },
      divider: t.border,
    },

    typography: {
      // Keep the established stack via the CSS variable (its value is
      // FONTS.ui, defined once in globalStyles.ts); the redesign does not
      // change fonts.
      fontFamily: 'var(--font-ui)',
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
      // App type scale. The redesign's display weight is 800 for page/hero
      // titles. Roomier body line heights support senior reading comfort.
      h1: { fontSize: '1.875rem', lineHeight: 1.2, fontWeight: 800 },
      h2: { fontSize: '1.5rem', lineHeight: 1.3333, fontWeight: 800 },
      h3: { fontSize: '1.25rem', lineHeight: 1.4, fontWeight: 700 },
      subtitle1: { fontSize: '1.125rem', lineHeight: 1.5556, fontWeight: 600 },
      body1: { fontSize: '1rem', lineHeight: 1.65 },
      body2: { fontSize: '0.875rem', lineHeight: 1.55 },
      caption: { fontSize: '0.75rem', lineHeight: 1.4 },
    },

    // Common radius = the button radius. Cards/pills that differ are
    // overridden per-component from `custom.radii`.
    shape: { borderRadius: RADII.button },

    // Compact 4px spacing unit used throughout the app.
    spacing: 4,

    // App responsive breakpoints; current layouts use md and lg.
    breakpoints: {
      values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 },
    },

    // Shared primitive defaults. These keep page-level components from
    // repeating radius, spacing, disabled, and surface treatments.
    components: {
      // Keep Paper surfaces exactly on the `surface` token: MUI's dark-mode
      // elevation overlay would otherwise lighten dialogs and menus.
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 700,
            // Senior-friendly touch target for regular buttons; dense rows use
            // size="small", hero CTAs use size="large".
            minHeight: 44,
            '&.Mui-disabled': { opacity: 0.5 },
          },
          sizeSmall: { minHeight: 36 },
          sizeLarge: {
            minHeight: 56,
            paddingBlock: 16,
            fontSize: '1.125rem',
          },
        },
        variants: [
          {
            props: { variant: 'contained', color: 'primary' },
            style: {
              background: custom.primaryBtnGradient,
              boxShadow: custom.btnShadow,
              '&:hover': { boxShadow: custom.btnShadow },
            },
          },
        ],
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            borderColor: t.border,
            borderRadius: RADII.card,
            // The tweakable card gradient over the solid surface fallback.
            // Split into color+image so MuiPaper's backgroundImage reset can
            // never race the gradient.
            backgroundColor: t.surface,
            backgroundImage: custom.cardBg.startsWith('linear-gradient')
              ? custom.cardBg
              : 'none',
            boxShadow: custom.cardShadow,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: RADII.card },
        },
      },
      MuiTextField: {
        defaultProps: { size: 'small', variant: 'outlined' },
      },
      MuiFormControl: {
        defaultProps: { size: 'small' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { backgroundColor: t.bg },
        },
      },
      MuiCheckbox: {
        defaultProps: { color: 'primary' },
      },
      MuiSlider: {
        defaultProps: { color: 'primary' },
      },
      MuiChip: {
        defaultProps: { size: 'small' },
        styleOverrides: {
          root: {
            minHeight: 24,
            height: 'auto',
            borderRadius: RADII.pill,
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            height: 8,
            borderRadius: RADII.pill,
            backgroundColor: t.cellRem,
          },
          bar: { borderRadius: RADII.pill },
        },
      },
    },
  });
}
