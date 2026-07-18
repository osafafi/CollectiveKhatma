import { useContext } from 'react';
import { SnackbarContext, type SnackbarContextValue } from './snackbarContext';

/**
 * Access the app-wide snackbar queue. Throws when used outside a
 * {@link SnackbarProvider} so a misplaced consumer fails loudly instead of
 * dropping notifications silently.
 */
export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider.');
  }
  return context;
}
