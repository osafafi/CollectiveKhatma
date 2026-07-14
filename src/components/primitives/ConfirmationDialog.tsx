import type { ReactNode } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { strings } from '@/content/strings.ar';
import { AppButton } from './AppButton';

export interface ConfirmationDialogProps {
  open: boolean;
  message: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  title?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
}

/** Controlled, RTL-safe replacement for native `window.confirm`. */
export function ConfirmationDialog({
  open,
  message,
  onConfirm,
  onCancel,
  title = strings.common.confirmTitle,
  confirmLabel = strings.common.confirm,
  cancelLabel = strings.common.cancel,
  tone = 'primary',
}: ConfirmationDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <AppButton variant="text" color="inherit" quiet onClick={onCancel}>
          {cancelLabel}
        </AppButton>
        <AppButton
          variant="contained"
          color={tone === 'danger' ? 'error' : 'primary'}
          onClick={onConfirm}
          autoFocus
        >
          {confirmLabel}
        </AppButton>
      </DialogActions>
    </Dialog>
  );
}
