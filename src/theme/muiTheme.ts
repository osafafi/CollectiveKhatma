import { createTheme, type Theme } from '@mui/material/styles';

/**
 * Centralized MUI theme (RM-210), refreshed under OD-03 (RM-460).
 *
 * The owner resolved OD-03 toward an **intentional visual refresh** — a fresh,
 * modern, senior-friendly look with reading-comfortable colors — rather than
 * pixel-parity with the legacy Tailwind UI. So this palette now **intentionally
 * diverges** from the Tailwind `@theme` block in [`theme.css`](./theme.css):
 *
 * - `theme.css` still carries the OLD palette because it styles the legacy tree,
 *   which stays in production until the RM-600 cutover and is deleted at RM-620.
 * - This file carries the REFRESHED palette that becomes production at cutover.
 *
 * `tests/theme/mui-theme.test.ts` therefore no longer asserts equality with
 * `theme.css`; it pins these refreshed values and asserts the divergence is
 * intentional (so neither copy drifts silently). Design intent and the WCAG-AA
 * contrast evidence are recorded in `docs/react-migration/tasks/RM-460.md`.
 */

/**
 * Refreshed design tokens (OD-03 / RM-460). Warm low-glare paper, a calm emerald
 * "Quran green" primary, a distinct gold accent (dark text), and higher-contrast
 * ink/muted for extended reading. See the RM-460 record for the contrast matrix.
 * These deliberately differ from `theme.css` `@theme` (see the file header).
 */
export const tokens = {
  color: {
    bg: '#f6f1e7', // warm ivory paper — softer, lower glare for long reading
    surface: '#fffdf7', // soft warm white — cards don't glare against the cream
    ink: '#26312b', // deep warm charcoal-green — ~13:1 on surface
    muted: '#5c6b62', // warm sage gray — AA (5.5:1) on surface
    primary: '#0e6f61', // calm emerald "Quran green"
    primaryStrong: '#0a5348', // hover/press dark tone
    accent: '#c9a24a', // gold highlight (dua/reciter, chart "pending"); dark text
    success: '#2f7d55', // natural leaf green
    warn: '#b45309', // amber caution — kept distinct from the red danger tone
    danger: '#b23a2e', // warm brick red — clear but less alarming
    border: '#e5ddcb', // warm sand hairline
    white: '#ffffff',
  },
  radius: {
    button: 12, // 0.75rem — buttons, fields, chips, badges, pills, bars
    card: 18, // softer 1.125rem — cards/sections/dialogs (RM-460 refresh)
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
      // Gold `--color-accent` (dua/reciter highlight, chart "pending"). It reads
      // as a bright gold, so filled secondary surfaces carry DARK ink text
      // rather than white (legible + premium) — the one semantic color that does
      // not use white contrast (RM-460 refresh; guarded in the theme test).
      secondary: {
        main: tokens.color.accent,
        contrastText: tokens.color.ink,
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
      // Roomier line-heights than the Tailwind defaults for senior reading
      // comfort (RM-460); font sizes are unchanged so layouts do not shift.
      body1: { fontSize: '1rem', lineHeight: 1.65 }, // text-base
      body2: { fontSize: '0.875rem', lineHeight: 1.55 }, // text-sm (rows, chips)
      caption: { fontSize: '0.75rem', lineHeight: 1.4 }, // text-xs (badges, legends)
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

    // Shared primitive defaults (RM-320). These keep page-level components from
    // repeating the legacy radius, spacing, disabled, and surface treatments.
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            '&.Mui-disabled': { opacity: 0.5 },
          },
          sizeLarge: {
            minHeight: 56,
            paddingBlock: 16,
            fontSize: '1.125rem',
          },
        },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            borderColor: tokens.color.border,
            borderRadius: tokens.radius.card,
            // Softer, warmer layered shadow (RM-460) — gentle depth that reads
            // modern and calm rather than the flat legacy 1px hairline.
            boxShadow: '0 1px 2px rgb(38 49 43 / 4%), 0 6px 20px rgb(38 49 43 / 5%)',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: tokens.radius.card },
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
          root: { backgroundColor: tokens.color.bg },
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
            borderRadius: tokens.radius.button,
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            height: 8,
            borderRadius: tokens.radius.button,
            backgroundColor: tokens.color.border,
          },
          bar: { borderRadius: tokens.radius.button },
        },
      },
    },
  });
}

/** Shared singleton theme consumed by {@link AppThemeProvider}. */
export const appTheme = createAppTheme();
