import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Person } from '@/domain/types';
import { db } from './firebase';

const rosterCol = collection(db, 'roster');

/**
 * Live-subscribe to the global roster, ordered by name. Returns an unsubscribe
 * function. Realtime listeners are the reason Firestore was chosen
 * (REQUIREMENTS §3).
 */
export function subscribeRoster(
  onChange: (people: Person[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(rosterCol, orderBy('name'));
  return onSnapshot(
    q,
    (snap) =>
      onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Person, 'id'>) }))),
    (error) => onError?.(error),
  );
}

/** Add a person to the roster. Returns the new document id. */
export async function addPerson(
  input: Pick<Person, 'name'> & Partial<Pick<Person, 'note'>>,
): Promise<string> {
  const ref = await addDoc(rosterCol, {
    name: input.name,
    ...(input.note ? { note: input.note } : {}),
    completedPages: [],
    createdAt: Date.now(),
  });
  return ref.id;
}

/** Update a person's editable fields (name/note). */
export function updatePerson(
  id: string,
  changes: Partial<Pick<Person, 'name' | 'note'>>,
): Promise<void> {
  return updateDoc(doc(rosterCol, id), changes);
}

/** Remove a person from the roster. */
export function removePerson(id: string): Promise<void> {
  return deleteDoc(doc(rosterCol, id));
}
