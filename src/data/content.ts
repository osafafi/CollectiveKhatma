import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { validDailyDuas } from '@/domain/dailyDua';
import type { GlobalContent } from '@/domain/types';
import { db } from './firebase';

/** Single global content document (admin-editable du3a text). */
const globalDoc = doc(db, 'content', 'global');

/** Read the global content once (undefined if not set yet). */
export async function getGlobalContent(): Promise<GlobalContent | undefined> {
  const snap = await getDoc(globalDoc);
  return snap.exists() ? (snap.data() as GlobalContent) : undefined;
}

/** Live-subscribe to the global content document. */
export function subscribeGlobalContent(
  onChange: (content: GlobalContent | undefined) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    globalDoc,
    (snap) => onChange(snap.exists() ? (snap.data() as GlobalContent) : undefined),
    (error) => onError?.(error),
  );
}

/** Set/replace the du3a2 al-khatma text (admin only). */
export function setDu3aText(du3aText: string): Promise<void> {
  return setDoc(globalDoc, { du3aText }, { merge: true });
}

export class DailyDuasConflictError extends Error {
  constructor() {
    super('Daily duas changed while editing');
  }
}

/** Compare the original list so another admin's changes cannot be overwritten. */
export async function setDailyDu3as(
  dailyDu3as: string[],
  expected: string[] | null,
): Promise<void> {
  if (!validDailyDuas(dailyDu3as)) throw new Error('Invalid daily duas');
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(globalDoc);
    const current = snapshot.data()?.dailyDu3as ?? null;
    if (JSON.stringify(current) !== JSON.stringify(expected))
      throw new DailyDuasConflictError();
    transaction.set(
      globalDoc,
      { dailyDu3as: dailyDu3as.map((text) => text.trim()) },
      { merge: true },
    );
  });
}
