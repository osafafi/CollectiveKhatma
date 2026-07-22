import { createContext, useContext } from 'react';
import type { ThemeMode } from '@/theme/tokens';

/**
 * Runtime theme settings owned by {@link AppThemeProvider}: the persisted
 * light/dark mode and its setter. Kept in the app layer so shared components
 * stay free of app state — they read the resolved values from the MUI theme.
 */
export interface ThemeSettings {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeSettingsContext = createContext<ThemeSettings | null>(null);

export function useThemeSettings(): ThemeSettings {
  const settings = useContext(ThemeSettingsContext);
  if (!settings) {
    throw new Error('useThemeSettings must be used within AppThemeProvider');
  }
  return settings;
}
