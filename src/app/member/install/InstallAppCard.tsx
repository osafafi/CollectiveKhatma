import { useMemo, useState } from 'react';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { AppButton, SurfaceCard } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { getInstallGuidance } from './installGuidance';
import { requestMemberInstall, useMemberInstall } from './memberInstall';

/** One-tap install where supported, with exact manual steps everywhere else. */
export function InstallAppCard() {
  const { canPrompt, isInstalled } = useMemberInstall();
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const guidance = useMemo(
    () =>
      getInstallGuidance({
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints,
      }),
    [],
  );

  if (isInstalled) return null;

  const onInstall = async () => {
    if (!canPrompt) {
      setInstructionsOpen(true);
      return;
    }

    const outcome = await requestMemberInstall();
    if (outcome !== 'accepted') setInstructionsOpen(true);
  };

  return (
    <>
      <SurfaceCard title={strings.settings.installTitle}>
        <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Box
            component="img"
            src={`${import.meta.env.BASE_URL}app-icons/app-icon-192.png`}
            alt=""
            width={80}
            height={80}
            sx={(theme) => ({
              borderRadius: `${theme.custom.radii.cardSm}px`,
              boxShadow: theme.shadows[2],
            })}
          />
          <Typography color="text.secondary">
            {strings.settings.installDescription}
          </Typography>
          <AppButton hero onClick={() => void onInstall()}>
            {canPrompt
              ? strings.settings.installButton
              : strings.settings.installInstructionsButton}
          </AppButton>
        </Stack>
      </SurfaceCard>

      <Dialog
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        aria-labelledby="install-instructions-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="install-instructions-title">
          {strings.settings.installDialogTitle}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography color="text.secondary">{guidance.environment}</Typography>
            <Box component="ol" sx={{ m: 0, pr: 3 }}>
              {guidance.steps.map((step) => (
                <Typography component="li" key={step} sx={{ mb: 1.5 }}>
                  {step}
                </Typography>
              ))}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <AppButton onClick={() => setInstructionsOpen(false)}>
            {strings.common.done}
          </AppButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
