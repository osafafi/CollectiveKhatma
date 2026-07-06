import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
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
