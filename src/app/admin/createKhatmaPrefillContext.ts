import { createContext, useContext } from 'react';
import type { MemberCapacity, PageScope } from '@/domain/types';

/**
 * A one-shot payload the Khatma detail page hands to the Khatmas create form when
 * the admin taps **start next in series** (`startNext`). The legacy apps share a
 * single app-lifetime `AdminDraft`, so `prefillNextKhatma` can mutate the create
 * form's fields and then navigate; in React each route unmounts on navigation, so
 * this context carries the seed across the unmount instead.
 */
export interface CreateKhatmaPrefill {
  seriesName: string;
  scope: PageScope;
  memberIds: string[];
  memberCaps: Record<string, MemberCapacity>;
  reciterId: string;
}

export interface CreateKhatmaPrefillContextValue {
  /** Stash a prefill for the next Khatmas-page mount to consume (from `startNext`). */
  requestPrefill: (prefill: CreateKhatmaPrefill) => void;
  /** Read any pending prefill without clearing it (safe to call during render). */
  peekPrefill: () => CreateKhatmaPrefill | null;
  /** Drop the pending prefill once the create form has seeded from it. */
  clearPrefill: () => void;
}

export const CreateKhatmaPrefillContext =
  createContext<CreateKhatmaPrefillContextValue | null>(null);

export function useCreateKhatmaPrefill(): CreateKhatmaPrefillContextValue {
  const value = useContext(CreateKhatmaPrefillContext);
  if (!value) {
    throw new Error(
      'useCreateKhatmaPrefill must be used within a CreateKhatmaPrefillProvider',
    );
  }
  return value;
}
