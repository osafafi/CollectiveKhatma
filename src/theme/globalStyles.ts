import { alpha, type Theme } from '@mui/material/styles';
import amiriQuranUrl from '@/theme/fonts/AmiriQuran.woff2';
import scheherazadeNewUrl from '@/theme/fonts/ScheherazadeNew.woff2';
import { FONTS } from '@/theme/tokens';

/**
 * App-specific global CSS retained alongside the MUI theme.
 *
 * These are app-specific rules that must NOT be forced into MUI components:
 * the bundled Quran webfont, the reading-scale variables, the `.quran-text`
 * mushaf flow, the redesign keyframes + reduced-motion guard, the
 * `.ayah-marker` gold glyph, the `.icon-mask` paint, and the `.tab-bar`
 * safe-area inset. This file also defines the `--font-ui` / `--font-quran`
 * CSS variables the theme and `.quran-text` reference. Base body/html color
 * and font rules belong to `CssBaseline` and the MUI theme.
 *
 * Exported as a function of the theme so mode-dependent values (focus ring,
 * color-scheme, ayah gold) always match the active light/dark palette.
 */
export function retainedGlobalStyles(theme: Theme) {
  return {
    '@font-face': [
      {
        fontFamily: 'Amiri Quran',
        src: `url(${amiriQuranUrl}) format('woff2')`,
        fontDisplay: 'swap',
      },

      {
        fontFamily: 'Scheherazade New',
        src: `url(${scheherazadeNewUrl}) format('woff2')`,
        fontDisplay: 'swap',
      },
    ],

    // Font stacks + default reading scale. `color-scheme` keeps native UI
    // (scrollbars, form controls) aligned with the active mode.
    ':root': {
      '--font-ui': FONTS.ui,
      '--font-quran': FONTS.quran,
      '--reading-scale': '1',
      colorScheme: theme.palette.mode,
    },

    // Visible keyboard focus ring. `:focus-visible` only fires for
    // keyboard/AT navigation, so pointer users see no outline while keyboard
    // users get a clear, high-contrast ring in the mode's primary (≥3:1 on
    // both app backgrounds — theme-test guarded).
    ':focus-visible': {
      outline: `3px solid ${alpha(theme.palette.primary.main, 0.7)}`,
      outlineOffset: '2px',
      borderRadius: '4px',
    },

    // Reading font-size scale — 5 discrete levels driven by `data-reading-scale`
    // on <html>. The shared reading control owns this senior-audience feature.
    "html[data-reading-scale='1']": { '--reading-scale': '0.9' },
    "html[data-reading-scale='2']": { '--reading-scale': '1' },
    "html[data-reading-scale='3']": { '--reading-scale': '1.15' },
    "html[data-reading-scale='4']": { '--reading-scale': '1.3' },
    "html[data-reading-scale='5']": { '--reading-scale': '1.5' },

    // Quran reading text: continuous, justified mushaf flow that scales with the
    // reading slider.
    '.quran-text': {
      fontFamily: 'var(--font-quran)',
      fontSize: 'calc(1.6rem * var(--reading-scale))',
      lineHeight: 2.5,
      textAlign: 'justify',
      textAlignLast: 'center',
    },

    // Ayah-end medallion: the Quran font glyph `۝` + Arabic-Indic number in
    // the design's gold, kept on one line with its ayah.
    '.ayah-marker': {
      color: theme.custom.gold,
      fontFamily: 'var(--font-quran)',
      whiteSpace: 'nowrap',
    },

    // Icons are image files painted with currentColor through a CSS mask so
    // monochrome SVGs and PNGs-with-alpha both tint to the active color. The
    // mask-image itself is set inline by the icon component.
    '.icon-mask': {
      display: 'inline-block',
      backgroundColor: 'currentColor',
      maskRepeat: 'no-repeat',
      maskPosition: 'center',
      maskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      WebkitMaskSize: 'contain',
    },

    // Bottom tab bar respects the iOS home-indicator safe area on phones; on large
    // screens it becomes a side rail, so the inset is moot.
    '.tab-bar': {
      paddingBottom: 'env(safe-area-inset-bottom)',
    },
    '@media (min-width: 1024px)': {
      '.tab-bar': {
        paddingBottom: 0,
      },
    },

    // Redesign motion vocabulary (design-system §4). Components reference these
    // by name with durations/easing from `theme.custom.motion`.
    '@keyframes fadeUp': {
      from: { opacity: 0, transform: 'translateY(16px)' },
      to: { opacity: 1, transform: 'none' },
    },
    '@keyframes shimmer': {
      '0%': { transform: 'translateY(-10%) rotate(12deg)', opacity: 0 },
      '25%': { opacity: 0.6 },
      '100%': { transform: 'translateY(60%) rotate(12deg)', opacity: 0 },
    },
    '@keyframes floaty': {
      '0%, 100%': { transform: 'translateY(0)' },
      '50%': { transform: 'translateY(-5px)' },
    },
    '@keyframes ringIn': {
      from: { opacity: 0, transform: 'scale(.88)' },
      to: { opacity: 1, transform: 'none' },
    },

    // Reduced-motion users get the final state of everything immediately.
    '@media (prefers-reduced-motion: reduce)': {
      '*, *::before, *::after': {
        animation: 'none !important',
        transition: 'none !important',
      },
    },
  } as const;
}
