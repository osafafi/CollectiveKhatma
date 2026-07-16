import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_PAGES_PER_DAY, type Person } from '@/domain/types';
import { isNameUnique, normalizeName } from '@/domain/validation';
import { db } from './firebase';

const rosterCol = collection(db, 'roster');

/** A latest-roster duplicate guard so UI validation failures stay friendly. */
export class DuplicatePersonNameError extends Error {
  constructor() {
    super('A roster member already uses this name');
    this.name = 'DuplicatePersonNameError';
  }
}

async function assertNameAvailable(name: string, excludedId?: string): Promise<void> {
  const snap = await getDocs(rosterCol);
  const people = snap.docs
    .filter((entry) => entry.id !== excludedId)
    .map((entry) => ({ name: String(entry.data().name ?? '') }));
  if (!isNameUnique(name, people)) throw new DuplicatePersonNameError();
}

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

/**
 * Add a person to the roster. The admin sets their daily page capacity
 * (`pagesPerDay`) at creation; new people start enabled. Returns the new id.
 */
export async function addPerson(
  input: Pick<Person, 'name'> & Partial<Pick<Person, 'note' | 'emoji' | 'pagesPerDay'>>,
): Promise<string> {
  const name = normalizeName(input.name);
  await assertNameAvailable(name);
  const ref = doc(rosterCol);
  await setDoc(ref, {
    name,
    ...(input.note ? { note: input.note } : {}),
    ...(input.emoji?.trim() ? { emoji: input.emoji.trim() } : {}),
    completedPages: [],
    pagesPerDay: input.pagesPerDay ?? DEFAULT_PAGES_PER_DAY,
    enabled: true,
    createdAt: Date.now(),
  });
  return ref.id;
}

/**
 * Update a person's editable fields: name/note, their daily capacity
 * (`pagesPerDay`, adjustable any time), and `enabled` (temporarily pausing them
 * from assignment without removing them — REQUIREMENTS §5+).
 */
export async function updatePerson(
  id: string,
  changes: Partial<Pick<Person, 'name' | 'note' | 'emoji' | 'pagesPerDay' | 'enabled'>>,
): Promise<void> {
  const name = changes.name === undefined ? undefined : normalizeName(changes.name);
  if (name !== undefined) await assertNameAvailable(name, id);
  const { emoji, ...otherChanges } = changes;
  await updateDoc(doc(rosterCol, id), {
    ...otherChanges,
    ...(name === undefined ? {} : { name }),
    ...('emoji' in changes
      ? { emoji: emoji?.trim() ? emoji.trim() : deleteField() }
      : {}),
  });
}

/** Rename through the duplicate-guarded person update path. */
export function renamePerson(id: string, name: string): Promise<void> {
  return updatePerson(id, { name });
}

/** Remove a person from the roster. */
export function removePerson(id: string): Promise<void> {
  return deleteDoc(doc(rosterCol, id));
}
