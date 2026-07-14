import { createContext } from 'react';

export interface ConfirmationOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
}

export interface ConfirmationContextValue {
  /** Queue a modal question and resolve to true only for explicit confirmation. */
  confirm: (options: ConfirmationOptions | string) => Promise<boolean>;
}

export const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);
