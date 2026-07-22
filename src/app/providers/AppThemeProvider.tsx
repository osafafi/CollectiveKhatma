import { useEffect, useMemo, type ReactNode } from 'react';
import { CacheProvider } from '@emotion/react';
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import { createKhatmaTheme } from '@/theme/muiTheme';
import { createRtlCache } from '@/theme/rtlCache';
import { retainedGlobalStyles } from '@/theme/globalStyles';
import { TOKENS } from '@/theme/tokens';
import { useThemeMode } from '@/app/persistence/browserPersistence';
import { ThemeSettingsContext } from '@/app/providers/themeSettingsContext';

/**
 * Centralized theme provider for both React apps.
 *
 * Composition order matters: the RTL Emotion cache must wrap the MUI
 * `ThemeProvider` so every styled element — including portalled ones — is
 * mirrored; `CssBaseline` applies the theme's paper background, ink text, and
 * font before the retained `GlobalStyles` layer.
 *
 * The provider owns the persisted light/dark mode and rebuilds the theme via
 * the `createKhatmaTheme` factory when it changes; Settings screens flip it
 * through {@link ThemeSettingsContext}.
 *
 * The Emotion cache is created once at module scope: caches are reusable
 * singletons, and re-creating one per render would thrash the injected styles.
 */
const rtlCache = createRtlCache();

interface AppThemeProviderProps {
  children: ReactNode;
}

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const [mode, setMode] = useThemeMode();
  const theme = useMemo(() => createKhatmaTheme(mode), [mode]);
  const settings = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  // Theme `direction: 'rtl'` sets MUI's logical flipping, but the DOM direction
  // is separate — guarantee it here so the tree is RTL even if a host document
  // forgets `dir`/`lang` (the preview HTML sets both; production entries land
  // later). Idempotent, so StrictMode's double-invoke is harmless.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', 'rtl');
    root.setAttribute('lang', 'ar');
  }, []);

  // Keep the browser chrome (address-bar tint) on the mode's app background.
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', TOKENS[mode].bg);
  }, [mode]);

  return (
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={theme}>
        <ThemeSettingsContext.Provider value={settings}>
          <CssBaseline />
          <GlobalStyles styles={retainedGlobalStyles} />
          {children}
        </ThemeSettingsContext.Provider>
      </ThemeProvider>
    </CacheProvider>
  );
}
