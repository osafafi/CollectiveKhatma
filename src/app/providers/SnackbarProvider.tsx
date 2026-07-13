import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { Alert, Snackbar, type SnackbarCloseReason } from '@mui/material';
import { strings } from '@/content/strings.ar';
import {
  SnackbarContext,
  type SnackbarContextValue,
  type SnackbarOptions,
  type SnackbarSeverity,
} from './snackbarContext';

interface SnackbarMessage {
  key: number;
  message: string;
  severity: SnackbarSeverity;
  duration: number | null;
}

const DEFAULT_DURATION = 5000;

interface SnackbarProviderProps {
  children: ReactNode;
}

/**
 * App-wide transient notifications (RM-300).
 *
 * Exposes `enqueueSnackbar` through context and renders one MUI `Snackbar` at a
 * time. Messages are held in a FIFO queue whose head is the visible message;
 * dismissing (manual close or auto-hide timeout) drops the head so the next
 * message surfaces, and the changing `key` re-runs the enter transition. This
 * avoids stacked toasts when several successes/failures fire in quick
 * succession. RTL-aware via the app's Emotion cache; anchored bottom-center so
 * it reads correctly in Arabic.
 */
export function SnackbarProvider({ children }: SnackbarProviderProps) {
  const [queue, setQueue] = useState<SnackbarMessage[]>([]);
  const keyRef = useRef(0);
  const current = queue[0];

  const enqueueSnackbar = useCallback((message: string, options?: SnackbarOptions) => {
    keyRef.current += 1;
    const item: SnackbarMessage = {
      key: keyRef.current,
      message,
      severity: options?.severity ?? 'info',
      duration: options?.duration === undefined ? DEFAULT_DURATION : options.duration,
    };
    setQueue((previous) => [...previous, item]);
  }, []);

  const closeSnackbar = useCallback(() => {
    setQueue((previous) => previous.slice(1));
  }, []);

  const handleClose = useCallback(
    (_event: Event | SyntheticEvent, reason?: SnackbarCloseReason) => {
      // Ignore click-away so an unrelated click never eats a message; timeout
      // and explicit close both advance the queue.
      if (reason === 'clickaway') return;
      setQueue((previous) => previous.slice(1));
    },
    [],
  );

  const value = useMemo<SnackbarContextValue>(
    () => ({ enqueueSnackbar, closeSnackbar }),
    [enqueueSnackbar, closeSnackbar],
  );

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        key={current?.key}
        open={Boolean(current)}
        autoHideDuration={current?.duration ?? undefined}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {current ? (
          <Alert
            severity={current.severity}
            variant="filled"
            onClose={closeSnackbar}
            closeText={strings.feedback.dismiss}
            sx={{ width: '100%' }}
          >
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </SnackbarContext.Provider>
  );
}
