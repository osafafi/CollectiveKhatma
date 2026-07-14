import { useContext } from 'react';
import {
  ConfirmationContext,
  type ConfirmationContextValue,
} from './confirmationContext';

/** Access the app-wide queued confirmation flow. */
export function useConfirmation(): ConfirmationContextValue {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider.');
  }
  return context;
}
