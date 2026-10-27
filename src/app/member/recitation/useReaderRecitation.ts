import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { getPage, getSurahs } from '@/content/quran/loader';
import type { Surah } from '@/content/quran/types';
import { strings } from '@/content/strings.ar';
import type { RecitationDockProps } from '@/components/recitation';
import type { LoadedQuranPage } from '../reader/useQuranPage';
import {
  createPagePlaylist,
  itemKey,
  pageRecitationItems,
  startIndexFor,
} from './recitationPlaylist';
import { verseLabel } from './recitationLabels';
import { useFollowActiveAyah } from './useFollowActiveAyah';
import type { RecitationSnapshot } from './recitationEngine';
import { useRecitation, useRecitationSnapshot } from './useRecitation';

export interface ReaderRecitationOptions {
  /** The page on screen. */
  displayedPage: number;
  /** That page, as the reader loaded it. */
  loaded: LoadedQuranPage;
  /** The pages playback may cover from a starting page, in order. */
  playPagesFrom: (page: number) => readonly number[];
  /** Browse stops at the end of the surah playback started in. */
  bound: 'list-end' | 'surah-end';
  /** Show a page because the recitation moved onto it. */
  turnTo: (page: number) => void;
}

export interface ReaderRecitation {
  dock: RecitationDockProps;
  /** The playing item's key when it is on the displayed page. */
  activeKey: string | undefined;
  /** Set while the bar is open: start reciting from a tapped verse. */
  onAyahTap: ((key: string) => void) | undefined;
}

/**
 * Recitation for one mounted mushaf reader. It owns a session on the shared
 * engine and keeps the reader and the audio agreeing on the page:
 * - the audio crossing into another page turns the reader there;
 * - the member turning the page while it plays restarts it at the top of the
 *   page they chose (or forgets the session if it was paused);
 * - unmounting (leaving the reader, or a remount for a new round) stops it.
 */
export function useReaderRecitation({
  displayedPage,
  loaded,
  playPagesFrom,
  bound,
  turnTo,
}: ReaderRecitationOptions): ReaderRecitation {
  const owner = useId();
  const { engine, qariId } = useRecitation();
  const snapshot = useRecitationSnapshot();
  const surahsById = useSurahTable();
  const mine = snapshot.owner === owner && snapshot.status !== 'idle';

  /** The page the audio last turned to, so that turn is not taken for a manual one. */
  const audioTurn = useRef<number | undefined>(undefined);
  const shownPage = useRef(displayedPage);
  const restartPending = useRef(false);

  const startFromLoaded = (startIndex = 0): void => {
    if (loaded.status !== 'ready') return;
    const start = pageRecitationItems(loaded.data, loaded.surahsById)[startIndex];
    if (!start) return;
    engine.start({
      owner,
      kind: 'reader',
      qariId,
      startIndex,
      playlist: createPagePlaylist({
        pages: playPagesFrom(loaded.page),
        seed: loaded.data,
        surahsById: loaded.surahsById,
        loadPage: getPage,
        stopAfterSurah: bound === 'surah-end' ? start.surah : undefined,
      }),
    });
  };

  // Follow the audio onto the next page.
  const onSnapshot = useEffectEvent((next: RecitationSnapshot) => {
    if (next.owner !== owner || !next.item) return;
    if (next.status !== 'loading' && next.status !== 'playing') return;
    if (next.item.page === displayedPage) return;
    audioTurn.current = next.item.page;
    turnTo(next.item.page);
  });

  useEffect(() => {
    let lastItem: string | undefined;
    return engine.subscribe(() => {
      const next = engine.getSnapshot();
      const key = next.item ? `${next.sessionId}:${next.index}` : undefined;
      if (key === lastItem) return;
      lastItem = key;
      onSnapshot(next);
    });
  }, [engine]);

  // A page change the audio did not ask for is the member's own turn.
  useEffect(() => {
    if (shownPage.current === displayedPage) return;
    shownPage.current = displayedPage;
    if (audioTurn.current === displayedPage) {
      audioTurn.current = undefined;
      return;
    }
    audioTurn.current = undefined;
    const current = engine.getSnapshot();
    if (current.owner !== owner) return;
    if (current.status === 'loading' || current.status === 'playing') {
      engine.pause();
      restartPending.current = true;
    } else {
      engine.stop(owner);
    }
  }, [displayedPage, engine, owner]);

  const restartOnLoaded = useEffectEvent(() => {
    if (!restartPending.current || loaded.status !== 'ready') return;
    restartPending.current = false;
    startFromLoaded(0);
  });

  useEffect(() => {
    restartOnLoaded();
  }, [loaded]);

  useEffect(() => () => engine.stop(owner), [engine, owner]);

  const item = mine ? snapshot.item : undefined;
  const status = mine ? snapshot.status : 'idle';
  // No glow behind the "not available" dialog: nothing is being recited.
  const activeKey =
    item && item.page === displayedPage && status !== 'unavailable'
      ? itemKey(item)
      : undefined;
  useFollowActiveAyah(activeKey, loaded.status === 'ready');

  return {
    activeKey,
    // While the bar is open, tapping a verse starts the recitation there.
    onAyahTap:
      mine && loaded.status === 'ready'
        ? (key) =>
            startFromLoaded(
              startIndexFor(pageRecitationItems(loaded.data, loaded.surahsById), key),
            )
        : undefined,
    dock: {
      status: status === 'unavailable' ? 'paused' : status,
      expanded: mine,
      verseLabel: item ? verseLabel(item, surahsById?.get(item.surah)?.name) : undefined,
      qariName:
        strings.recitation.qariNames[mine && snapshot.qariId ? snapshot.qariId : qariId],
      disabled: loaded.status !== 'ready',
      onPlay: () => {
        if (mine && snapshot.status === 'paused') engine.resume();
        else startFromLoaded(0);
      },
      onPause: () => engine.pause(),
      onNext: () => engine.next(),
      onPrevious: () => engine.previous(),
      onClose: () => engine.stop(owner),
    },
  };
}

/** The surah table, for labelling an item on a page that is still loading. */
function useSurahTable(): ReadonlyMap<number, Surah> | undefined {
  const [surahsById, setSurahsById] = useState<ReadonlyMap<number, Surah>>();
  useEffect(() => {
    let active = true;
    getSurahs()
      .then((surahs) => {
        if (active) setSurahsById(new Map(surahs.map((surah) => [surah.id, surah])));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return surahsById;
}
