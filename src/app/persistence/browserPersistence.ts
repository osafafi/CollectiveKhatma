import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_READING_SCALE, type ReadingScale } from '@/theme/reading';
import type { ThemeMode } from '@/theme/tokens';

const MEMBER_ID_KEY = 'khatma.memberId';
const READING_SCALE_KEY = 'khatma.readingScale';
const LAST_READ_PAGE_KEY = 'khatma.lastReadPage';
const THEME_MODE_KEY = 'khatma.themeMode';
const DU3A_ACK_PREFIX = 'khatma.du3aAck.';

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
