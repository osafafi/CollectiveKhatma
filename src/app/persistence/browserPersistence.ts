import { useCallback, useEffect, useState } from 'react';
import {
  clampVerseOverlapMs,
  DEFAULT_QARI_ID,
  isQariId,
  type QariId,
} from '@/content/quran/recitation';
import { DEFAULT_READING_SCALE, type ReadingScale } from '@/theme/reading';
import type { ThemeMode } from '@/theme/tokens';

const MEMBER_ID_KEY = 'khatma.memberId';
const READING_SCALE_KEY = 'khatma.readingScale';
const LAST_READ_PAGE_KEY = 'khatma.lastReadPage';
const THEME_MODE_KEY = 'khatma.themeMode';
const QARI_KEY = 'khatma.qari';
const VERSE_OVERLAP_KEY = 'khatma.verseOverlap';
const REMAINDER_ASSIGNEE_KEY = 'khatma.admin.remainderAssigneeId';
const DU3A_ACK_PREFIX = 'khatma.du3aAck.';
const ASSIGNED_READER_PAGE_PREFIX = 'khatma.assignedReaderPage.';

export const TOTAL_QURAN_PAGES = 604;

type PersistentValue<T> = readonly [value: T, setValue: (value: T) => void];

/** Remember or clear the trust-based member identity for this browser. */
export function useRememberedMemberId(): PersistentValue<string | null> {
  const [memberId, setMemberIdState] = useState<string | null>(() => read(MEMBER_ID_KEY));

  const setMemberId = useCallback((nextMemberId: string | null): void => {
    setMemberIdState(nextMemberId);
    if (nextMemberId === null) remove(MEMBER_ID_KEY);
    else write(MEMBER_ID_KEY, nextMemberId);
  }, []);

  return [memberId, setMemberId];
}

/** Remember the admin's preferred recipient for end-of-khatma remainder pages. */
export function useRememberedRemainderAssigneeId(
  defaultMemberId: string | null = null,
): PersistentValue<string | null> {
  const [memberId, setMemberIdState] = useState<string | null>(
    () => read(REMAINDER_ASSIGNEE_KEY) ?? defaultMemberId,
  );

  const setMemberId = useCallback((nextMemberId: string | null): void => {
    setMemberIdState(nextMemberId);
    if (nextMemberId === null) remove(REMAINDER_ASSIGNEE_KEY);
    else write(REMAINDER_ASSIGNEE_KEY, nextMemberId);
  }, []);

  return [memberId, setMemberId];
}

/** Persist and apply the shared five-level Quran reading scale. */
export function useReadingScale(): PersistentValue<ReadingScale> {
  const [scale, setScale] = useState<ReadingScale>(() =>
    parseReadingScale(read(READING_SCALE_KEY)),
  );

  useEffect(() => {
    applyReadingScale(scale);
    write(READING_SCALE_KEY, String(scale));
  }, [scale]);

  return [scale, setScale];
}

/**
 * Persist the light/dark theme choice shared by the member and admin entries
 * (same origin → same storage). Light is the default; the Settings screens own
 * the only toggle.
 */
export function useThemeMode(): PersistentValue<ThemeMode> {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    parseThemeMode(read(THEME_MODE_KEY)),
  );

  const setMode = useCallback((nextMode: ThemeMode): void => {
    setModeState(nextMode);
    write(THEME_MODE_KEY, nextMode);
  }, []);

  return [mode, setMode];
}

/**
 * The member's recitation voice on this device. Alafasy until they pick one;
 * an id the catalog no longer carries falls back the same way.
 */
export function useQariPreference(): PersistentValue<QariId> {
  const [qariId, setQariIdState] = useState<QariId>(() => parseQariId(read(QARI_KEY)));

  const setQariId = useCallback((nextQariId: QariId): void => {
    setQariIdState(nextQariId);
    write(QARI_KEY, nextQariId);
  }, []);

  return [qariId, setQariId];
}

export type VerseOverlapPreferences = Partial<Record<QariId, number>>;

/**
 * Per-voice tail overlap (ms) tuned in Settings on this device. Voices never
 * tuned are absent, so the catalog default applies to them.
 */
export function useVerseOverlapPreferences(): readonly [
  overlaps: VerseOverlapPreferences,
  setOverlap: (qariId: QariId, ms: number) => void,
] {
  const [overlaps, setOverlaps] = useState<VerseOverlapPreferences>(() =>
    parseVerseOverlaps(read(VERSE_OVERLAP_KEY)),
  );

  const setOverlap = useCallback((qariId: QariId, ms: number): void => {
    setOverlaps((current) => {
      const next = { ...current, [qariId]: clampVerseOverlapMs(ms) };
      write(VERSE_OVERLAP_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return [overlaps, setOverlap];
}

/** Resume and update the browse reader's last valid mushaf page. */
export function useLastReadPage(): PersistentValue<number> {
  const [page, setPageState] = useState(() =>
    parseLastReadPage(read(LAST_READ_PAGE_KEY)),
  );

  const setPage = useCallback((nextPage: number): void => {
    const validPage = validLastReadPage(nextPage) ? nextPage : 1;
    setPageState(validPage);
    write(LAST_READ_PAGE_KEY, String(validPage));
  }, []);

  return [page, setPage];
}

/**
 * The page a member last had open in one khatma's assigned reader on this
 * browser, or null. Plain reads and writes rather than a hook: the reader
 * consults it once when it opens and only writes it afterwards.
 */
export function readAssignedReaderPage(
  khatmaId: string,
  memberId: string,
): number | null {
  const page = Number(read(assignedReaderPageKey(khatmaId, memberId)));
  return validLastReadPage(page) ? page : null;
}

export function rememberAssignedReaderPage(
  khatmaId: string,
  memberId: string,
  page: number,
): void {
  if (!validLastReadPage(page)) return;
  write(assignedReaderPageKey(khatmaId, memberId), String(page));
}

export function forgetAssignedReaderPage(khatmaId: string, memberId: string): void {
  remove(assignedReaderPageKey(khatmaId, memberId));
}

/** Read and acknowledge the completion overlay for one khatma. */
export function useDu3aAcknowledgement(
  khatmaId: string,
): readonly [acknowledged: boolean, acknowledge: () => void] {
  const key = `${DU3A_ACK_PREFIX}${khatmaId}`;
  const [state, setState] = useState(() => ({ key, acknowledged: read(key) === '1' }));
  const acknowledged = state.key === key ? state.acknowledged : read(key) === '1';

  const acknowledge = useCallback((): void => {
    setState({ key, acknowledged: true });
    write(key, '1');
  }, [key]);

  return [acknowledged, acknowledge];
}

function parseThemeMode(value: string | null): ThemeMode {
  return value === 'dark' ? 'dark' : 'light';
}

function parseQariId(value: string | null): QariId {
  return isQariId(value) ? value : DEFAULT_QARI_ID;
}

function parseVerseOverlaps(value: string | null): VerseOverlapPreferences {
  let stored: unknown;
  try {
    stored = value === null ? null : JSON.parse(value);
  } catch {
    return {};
  }
  if (typeof stored !== 'object' || stored === null) return {};
  const overlaps: VerseOverlapPreferences = {};
  for (const [qariId, ms] of Object.entries(stored)) {
    if (isQariId(qariId) && typeof ms === 'number' && Number.isFinite(ms)) {
      overlaps[qariId] = clampVerseOverlapMs(ms);
    }
  }
  return overlaps;
}

function parseReadingScale(value: string | null): ReadingScale {
  const scale = Number(value);
  return scale === 1 || scale === 2 || scale === 3 || scale === 4 || scale === 5
    ? scale
    : DEFAULT_READING_SCALE;
}

function parseLastReadPage(value: string | null): number {
  const page = Number(value);
  return validLastReadPage(page) ? page : 1;
}

function validLastReadPage(page: number): boolean {
  return Number.isInteger(page) && page >= 1 && page <= TOTAL_QURAN_PAGES;
}

function assignedReaderPageKey(khatmaId: string, memberId: string): string {
  return `${ASSIGNED_READER_PAGE_PREFIX}${khatmaId}.${memberId}`;
}

function applyReadingScale(scale: ReadingScale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.readingScale = String(scale);
}

function read(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  } catch {
    // The in-memory React state remains usable when browser storage is blocked.
  }
}

function remove(key: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  } catch {
    // The in-memory React state remains usable when browser storage is blocked.
  }
}
