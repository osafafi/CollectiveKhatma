import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Fade,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { AppButton } from '@/components/primitives';
import { strings } from '@/content/strings.ar';

export interface RecitationUnavailableDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The one message every recitation failure ends in — offline, a data bundle
 * that only reaches some apps, a host that never answers. It never names a
 * technical cause it cannot be sure of; reading carries on as usual.
 */
export function RecitationUnavailableDialog({
  open,
  onClose,
}: RecitationUnavailableDialogProps) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const duration = reducedMotion ? 0 : parseFloat(theme.custom.motion.fast) * 1000;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="recitation-unavailable-title"
      aria-describedby="recitation-unavailable-body"
      slots={{ transition: Fade }}
      transitionDuration={duration}
    >
      <DialogTitle id="recitation-unavailable-title">
        {strings.recitation.unavailableTitle}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="recitation-unavailable-body">
          {strings.recitation.unavailableBody}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <AppButton fullWidth autoFocus onClick={onClose}>
          {strings.recitation.dismiss}
        </AppButton>
      </DialogActions>
    </Dialog>
  );
}
