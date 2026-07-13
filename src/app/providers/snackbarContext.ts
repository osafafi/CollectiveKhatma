import { createContext } from 'react';

export type SnackbarSeverity = 'success' | 'info' | 'warning' | 'error';

export interface SnackbarOptions {
  /** Alert color. Defaults to `info`. */
  severity?: SnackbarSeverity;
  /** Auto-hide delay in ms; `null` keeps it open until dismissed. */
  duration?: number | null;
}

export interface SnackbarContextValue {
  /** Queue a transient message; extras wait their turn behind the current one. */
  enqueueSnackbar: (message: string, options?: SnackbarOptions) => void;
  /** Dismiss the message currently shown, promoting the next queued one. */
  closeSnackbar: () => void;
}

/**
 * Null default so {@link useSnackbar} can detect and reject use outside the
 * provider, rather than silently no-op'ing an enqueue.
 */
export const SnackbarContext = createContext<SnackbarContextValue | null>(null);
