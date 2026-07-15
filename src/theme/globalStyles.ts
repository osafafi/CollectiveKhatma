import type { Interpolation, Theme } from '@mui/material/styles';
import amiriQuranUrl from '@/theme/fonts/AmiriQuran.woff2';

/**
 * App-specific global CSS retained alongside the MUI theme (AD-09).
 *
 * These are app-specific rules that must NOT be forced into MUI components:
 * the bundled Quran webfont, the reading-scale variables, the `.quran-text`
 * mushaf flow, the `.icon-mask` paint, and the `.tab-bar` safe-area inset. The
 * This file also defines the `--font-ui` / `--font-quran` CSS variables the
 * theme and `.quran-text` reference. Base body/html color and font rules belong
 * to `CssBaseline` and the MUI theme.
 */
export const retainedGlobalStyles: Interpolation<Theme> = {
  '@font-face': {
    fontFamily: 'Amiri Quran',
    src: `url(${amiriQuranUrl}) format('woff2')`,
    fontDisplay: 'swap',
  },

  // Font stacks + default reading scale.
  ':root': {
    '--font-ui': "'Tajawal', system-ui, -apple-system, 'Segoe UI', sans-serif",
    '--font-quran': "'Amiri Quran', 'Amiri', 'Scheherazade New', serif",
    '--reading-scale': '1',
  },

  // Visible keyboard focus ring (RM-460 accessibility refresh). `:focus-visible`
  // only fires for keyboard/AT navigation, so pointer users see no outline while
  // keyboard users get a clear, high-contrast emerald ring. The color is the
  // refreshed primary (#0e6f61) at 55% alpha; kept literal here so this stays a
  // theme-free stylesheet.
  ':focus-visible': {
    outline: '3px solid rgba(14, 111, 97, 0.55)',
    outlineOffset: '2px',
    borderRadius: '4px',
  },

  // Reading font-size scale — 5 discrete levels driven by `data-reading-scale`
  // on <html> (RM-340 owns the React control). Senior-audience feature.
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

  // Icons are image files painted with currentColor through a CSS mask so
  // monochrome SVGs and PNGs-with-alpha both tint to the active color. The
  // mask-image itself is set inline by the icon component (RM-330).
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
};
