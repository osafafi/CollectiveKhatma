import type { ReactElement } from 'react';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { Stack } from '@mui/material';
import { useThemeSettings } from '@/app/providers/themeSettingsContext';
import { AppButton, SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import type { ThemeMode } from '@/theme/tokens';

/**
 * The light/dark appearance card shared by the member and admin Settings
 * screens — the ONLY place the theme toggle appears. The choice persists via
 * the provider (`khatma.themeMode`) and applies live to the whole app.
 */
export function AppearanceSettingsCard() {
  const { mode, setMode } = useThemeSettings();

  const options: ReadonlyArray<{
    mode: ThemeMode;
    label: string;
    icon: ReactElement;
  }> = [
    { mode: 'light', label: strings.settings.themeLight, icon: <LightModeRoundedIcon /> },
    { mode: 'dark', label: strings.settings.themeDark, icon: <DarkModeRoundedIcon /> },
  ];

  return (
    <SurfaceCard title={strings.settings.appearanceTitle}>
      <Stack
        direction="row"
        spacing={1.5}
        role="group"
        aria-label={strings.settings.appearanceTitle}
        sx={(theme) => ({
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: `${theme.custom.radii.button}px`,
          p: 1,
        })}
      >
        {options.map((option) => {
          const active = option.mode === mode;
          return (
            <AppButton
              key={option.mode}
              variant={active ? 'contained' : 'text'}
              color={active ? 'primary' : 'inherit'}
              startIcon={option.icon}
              aria-pressed={active}
              onClick={() => setMode(option.mode)}
              sx={(theme) => ({
                flex: 1,
                borderRadius: `${theme.custom.radii.pill}px`,
                ...(active ? null : { color: 'text.secondary', fontWeight: 600 }),
              })}
            >
              {option.label}
            </AppButton>
          );
        })}
      </Stack>
    </SurfaceCard>
  );
}
