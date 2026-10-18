import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  onSnapshot,
  runTransaction,
  writeBatch,
  type CollectionReference,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Khatma, PageScope, WirdCompletion } from '@/domain/types';
import { db } from './firebase';
import { khatmasCol } from './khatmas';

export const MAX_WIRD_DUA_LENGTH = 100_000;

export interface WirdContentInput {
  scope: Extract<PageScope, { kind: 'surahs' | 'juz' | 'dua' }>;
  pages: number[];
  duaText?: string;
}

export interface CreateWirdInput extends WirdContentInput {
  seriesId: string;
  seriesName: string;
  seriesNumber: number;
  memberId: string;
  imageName?: string;
  createdAt?: number;
}

export interface UpdateWirdInput extends WirdContentInput {
  memberId: string;
}

export interface CompleteWirdDayInput {
  wirdId: string;
  memberId: string;
  date: string;
  completedAt: number;
  contentKind: 'quran' | 'dua';
  pages: number[];
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function normalizedContent(input: WirdContentInput): WirdContentInput {
  const pages = [...new Set(input.pages)]
    .filter((page) => Number.isInteger(page) && page >= 1 && page <= 604)
    .sort((left, right) => left - right);
  if (input.scope.kind === 'dua') {
    const duaText = input.duaText?.trim() ?? '';
    if (duaText.length === 0 || duaText.length > MAX_WIRD_DUA_LENGTH) {
      throw new Error("Wird du'a must contain between 1 and 100000 characters");
    }
    return { scope: { kind: 'dua' }, pages: [], duaText };
  }
  const ids = input.scope.kind === 'surahs' ? input.scope.surahIds : input.scope.juzIds;
  if (ids.length === 0 || pages.length === 0) {
    throw new Error('A Quran Wird requires at least one Surah or Juz');
  }
  return { scope: input.scope, pages };
}

function storedContent(content: WirdContentInput): Record<string, unknown> {
  return {
    scope: content.scope,
    totalPages: content.pages.length,
    remainingPages: content.pages,
    ...(content.scope.kind === 'dua' ? { wirdDuaText: content.duaText } : {}),
  };
}

/** Create an indefinite, single-member Wird without entering khatma distribution. */
export async function createWird(input: CreateWirdInput): Promise<string> {
  if (!input.memberId.trim()) throw new Error('A Wird requires one member');
  const content = normalizedContent(input);
  const wirdRef = doc(khatmasCol);
  const batch = writeBatch(db);
  batch.set(wirdRef, {
    kind: 'wird',
    seriesId: input.seriesId,
    seriesName: input.seriesName,
    seriesNumber: input.seriesNumber,
    memberIds: [input.memberId],
    pastMemberIds: [],
    capacities: {
      [input.memberId]: { pages: 0, surahs: 0, juz: 0 },
    },
    status: 'active',
    roundCount: 0,
    completionCount: 0,
    duaReciterId: '',
    createdAt: input.createdAt ?? Date.now(),
    ...(input.imageName?.trim() ? { imageName: input.imageName.trim() } : {}),
    ...storedContent(content),
  });
  await batch.commit();
  return wirdRef.id;
}

/** Change future daily content/member while retaining immutable past completions. */
export async function updateWird(id: string, input: UpdateWirdInput): Promise<void> {
  if (!input.memberId.trim()) throw new Error('A Wird requires one member');
  const content = normalizedContent(input);
  await runTransaction(db, async (tx) => {
    const ref = doc(khatmasCol, id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error(`updateWird: ${id} not found`);
    const wird = snap.data() as Omit<Khatma, 'id'>;
    if (wird.kind !== 'wird') throw new Error('updateWird: target is not a Wird');
    const previousMemberId = wird.memberIds[0];
    const pastMemberIds = new Set(wird.pastMemberIds ?? []);
    if (previousMemberId && previousMemberId !== input.memberId) {
      pastMemberIds.add(previousMemberId);
    }
    const changes: Record<string, unknown> = {
      memberIds: [input.memberId],
      pastMemberIds: [...pastMemberIds],
      capacities: { [input.memberId]: { pages: 0, surahs: 0, juz: 0 } },
      ...storedContent(content),
    };
    if (content.scope.kind !== 'dua') changes.wirdDuaText = deleteField();
    tx.update(ref, changes);
  });
}

export function setWirdStatus(id: string, status: 'active' | 'archived'): Promise<void> {
  return runTransaction(db, async (tx) => {
    const ref = doc(khatmasCol, id);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const wird = snap.data() as Omit<Khatma, 'id'>;
    if (wird.kind !== 'wird') throw new Error('setWirdStatus: target is not a Wird');
    tx.update(
      ref,
      status === 'archived'
        ? { status, completedAt: Date.now() }
        : { status, completedAt: deleteField() },
    );
  });
}

export function wirdCompletionsCol(wirdId: string): CollectionReference {
  return collection(doc(khatmasCol, wirdId), 'wirdCompletions');
}

export function subscribeWirdCompletions(
  wirdId: string,
  onChange: (completions: WirdCompletion[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    wirdCompletionsCol(wirdId),
    (snapshot) =>
      onChange(
        snapshot.docs.map((entry) => ({
          id: entry.id,
          ...(entry.data() as Omit<WirdCompletion, 'id'>),
        })),
      ),
    (error) => onError?.(error),
  );
}

/** Idempotently credit one local-calendar day using the content seen at tap time. */
export function completeWirdDay(input: CompleteWirdDayInput): Promise<void> {
  if (!validIsoDate(input.date) || !Number.isFinite(input.completedAt)) {
    return Promise.reject(new Error('completeWirdDay: invalid completion date'));
  }
  const pages = [...new Set(input.pages)]
    .filter((page) => Number.isInteger(page) && page >= 1 && page <= 604)
    .sort((left, right) => left - right);
  if (input.contentKind === 'quran' && pages.length === 0) {
    return Promise.reject(new Error('completeWirdDay: Quran completion has no pages'));
  }
  if (input.contentKind === 'dua' && pages.length !== 0) {
    return Promise.reject(
      new Error("completeWirdDay: du'a completion cannot credit pages"),
    );
  }

  return runTransaction(db, async (tx) => {
    const wirdRef = doc(khatmasCol, input.wirdId);
    const completionRef = doc(
      wirdCompletionsCol(input.wirdId),
      `${input.memberId}_${input.date}`,
    );
    const personRef = doc(db, 'roster', input.memberId);
    const [wirdSnap, completionSnap] = await Promise.all([
      tx.get(wirdRef),
      tx.get(completionRef),
    ]);
    if (completionSnap.exists()) return;
    if (!wirdSnap.exists()) throw new Error(`completeWirdDay: ${input.wirdId} not found`);
    const wird = wirdSnap.data() as Omit<Khatma, 'id'>;
    if (wird.kind !== 'wird') throw new Error('completeWirdDay: target is not a Wird');
    const mayComplete =
      wird.memberIds.includes(input.memberId) ||
      wird.pastMemberIds?.includes(input.memberId) === true;
    const archivedAfterTap =
      wird.status === 'archived' &&
      wird.completedAt !== undefined &&
      input.completedAt <= wird.completedAt;
    if (!mayComplete || (wird.status !== 'active' && !archivedAfterTap)) {
      throw new Error('completeWirdDay: member or Wird is no longer active');
    }

    const completion: Omit<WirdCompletion, 'id'> = {
      memberId: input.memberId,
      date: input.date,
      completedAt: input.completedAt,
      contentKind: input.contentKind,
      pages,
    };
    tx.set(completionRef, completion);
    tx.update(wirdRef, {
      completionCount: (wird.completionCount ?? 0) + 1,
      roundCount: (wird.roundCount ?? 0) + 1,
      lastDistributionDate: input.date,
    });
    if (pages.length > 0) tx.update(personRef, { completedPages: arrayUnion(...pages) });
  });
}
