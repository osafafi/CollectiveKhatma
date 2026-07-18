import { useEffect, type ReactNode } from 'react';
import { CacheProvider } from '@emotion/react';
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import { appTheme } from '@/theme/muiTheme';
import { createRtlCache } from '@/theme/rtlCache';
import { retainedGlobalStyles } from '@/theme/globalStyles';

/**
 * Centralized theme provider for both React apps.
 *
 * Composition order matters: the RTL Emotion cache must wrap the MUI
 * `ThemeProvider` so every styled element — including portalled ones — is
 * mirrored; `CssBaseline` applies the theme's paper background, ink text, and
 * font before the retained `GlobalStyles` layer.
 *
 * The Emotion cache is created once at module scope: caches are reusable
 * singletons, and re-creating one per render would thrash the injected styles.
 */
const rtlCache = createRtlCache();

interface AppThemeProviderProps {
  children: ReactNode;
}

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  // Theme `direction: 'rtl'` sets MUI's logical flipping, but the DOM direction
  // is separate — guarantee it here so the tree is RTL even if a host document
  // forgets `dir`/`lang` (the preview HTML sets both; production entries land
  // later). Idempotent, so StrictMode's double-invoke is harmless.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', 'rtl');
    root.setAttribute('lang', 'ar');
  }, []);

  return (
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <GlobalStyles styles={retainedGlobalStyles} />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
