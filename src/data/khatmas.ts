import { collection, type CollectionReference } from 'firebase/firestore';
import type { Khatma } from '@/domain/types';
import { db } from './firebase';

/** Firestore collection handle for khatmas. */
export const khatmasCol: CollectionReference = collection(db, 'khatmas');

// -----------------------------------------------------------------------------
// STUBS — implemented in Stage 2 (feature work). Kept with their final
// signatures so the UI can be wired against them now.
// -----------------------------------------------------------------------------

export function subscribeKhatmas(
  _onChange: (khatmas: Khatma[]) => void,
  _onError?: (error: Error) => void,
): never {
  throw new Error('subscribeKhatmas: not implemented yet (Stage 2)');
}

export function createKhatma(
  _khatma: Omit<Khatma, 'id' | 'createdAt' | 'status'>,
): Promise<string> {
  throw new Error('createKhatma: not implemented yet (Stage 2)');
}
