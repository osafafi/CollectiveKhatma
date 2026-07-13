import { createTheme, type Theme } from '@mui/material/styles';

/**
 * Centralized MUI theme (RM-210) — the React-side twin of the Tailwind `@theme`
 * block in [`theme.css`](./theme.css). Built to the token contract in
 * `REACT_MIGRATION_THEME_MAP.md` §2–§6.
 *
 * During the migration the palette lives in TWO places: this file (for the React
 * tree) and `theme.css`'s `@theme` (for the still-legacy tree). They are two
 * copies of one palette and MUST hold the same hex values — the accepted R1
 * transition pattern. `tests/theme/mui-theme.test.ts` guards that they stay in
 * sync; the duplication is removed when Tailwind goes at RM-620.
 */

/**
 * Design tokens, mirrored verbatim from `theme.css` `@theme`. Keep this in sync
 * with that file until RM-620 removes the Tailwind copy.
 */
export const tokens = {
  color: {
    bg: '#faf7f0',
    surface: '#ffffff',
    ink: '#1f2a24',
    muted: '#6b7280',
    primary: '#0f766e',
    primaryStrong: '#115e59',
    accent: '#b45309',
    success: '#15803d',
    warn: '#b45309',
    danger: '#b91c1c',
    border: '#e7e2d6',
    white: '#ffffff',
  },
  radius: {
    button: 12, // 0.75rem — buttons, fields, chips, badges, pills, bars
    card: 16, // 1rem — cards/sections (applied per-component in RM-320)
  },
  font: {
    // Same stacks as theme.css `@theme`; exposed as CSS vars in globalStyles.ts
    // so `var(--font-ui)` / `var(--font-quran)` resolve without theme.css.
    ui: 'var(--font-ui)',
  },
} as const;

/**
 * Build the app theme. Exported as a factory so tests can construct a fresh
 * instance; `appTheme` is the shared singleton the provider consumes.
 */
export function createAppTheme(): Theme {
  return createTheme({
    // RTL is the app's only direction (Arabic). Pairs with the stylis RTL
    // Emotion cache in rtlCache.ts and `dir="rtl"` set by AppThemeProvider.
    direction: 'rtl',

    palette: {
      mode: 'light',
      primary: {
        main: tokens.color.primary,
        // Revive the otherwise-dead `--color-primary-strong` as the dark tone
        // MUI needs for hover/press states (theme-map R2).
        dark: tokens.color.primaryStrong,
        contrastText: tokens.color.white,
      },
      // Amber `--color-accent`; used today only as the chart "pending" color.
      secondary: {
        main: tokens.color.accent,
        contrastText: tokens.color.white,
      },
      success: { main: tokens.color.success, contrastText: tokens.color.white },
      // NOTE (theme-map R3): warn shares its hex with accent by design today.
      warning: { main: tokens.color.warn, contrastText: tokens.color.white },
      error: { main: tokens.color.danger, contrastText: tokens.color.white },
      background: {
        default: tokens.color.bg, // warm paper
        paper: tokens.color.surface,
      },
      text: {
        primary: tokens.color.ink,
        secondary: tokens.color.muted,
      },
      divider: tokens.color.border,
    },

    typography: {
      // Keep the exact legacy stack via the CSS var (theme-map R4): Tajawal
      // preferred, system-ui fallback. No third-party font runtime is added;
      // the self-host-Tajawal-vs-drop decision stays an OD-03 input.
      fontFamily: tokens.font.ui,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
      // Type scale from theme-map §3.2 (Tailwind v4 defaults). Heading teal
      // (`text-primary`) is applied where headings are used, not globally.
      h1: { fontSize: '1.875rem', lineHeight: 1.2, fontWeight: 700 }, // text-3xl (gate title)
      h2: { fontSize: '1.5rem', lineHeight: 1.3333, fontWeight: 700 }, // text-2xl (route h1)
      h3: { fontSize: '1.25rem', lineHeight: 1.4, fontWeight: 600 }, // text-xl (card/surah header)
      subtitle1: { fontSize: '1.125rem', lineHeight: 1.5556, fontWeight: 600 }, // text-lg (emphasis)
      body1: { fontSize: '1rem', lineHeight: 1.5 }, // text-base
      body2: { fontSize: '0.875rem', lineHeight: 1.4286 }, // text-sm (rows, chips)
      caption: { fontSize: '0.75rem', lineHeight: 1.3333 }, // text-xs (badges, legends)
    },

    // Common radius = the button radius (12px). Cards/pills that differ (16px /
    // full) are overridden per-component in RM-320.
    shape: { borderRadius: tokens.radius.button },

    // Tailwind's base spacing unit is 4px (MUI default is 8px). Set 4 so the
    // legacy `p-4`=16px / `gap-2`=8px mental model maps 1:1 (theme-map §5).
    spacing: 4,

    // Override to Tailwind's pixel breakpoints so `up('md')`/`up('lg')` fire at
    // the same widths the legacy `md:`/`lg:` utilities do (theme-map §6). The app
    // only actually uses md (768) and lg (1024).
    breakpoints: {
      values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 },
    },
  });
}

/** Shared singleton theme consumed by {@link AppThemeProvider}. */
export const appTheme = createAppTheme();
