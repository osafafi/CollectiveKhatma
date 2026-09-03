import { TOTAL_QURAN_PAGES } from '@/app/persistence';
import { quranMetadataUrls, quranPageUrl } from '@/content/quran/loader';

/**
 * Background sweep that pulls the whole mushaf into the service worker's cache,
 * so a member who loses their connection keeps every page — not only the ones
 * they happened to open first.
 *
 * It fetches raw URLs instead of calling `getPage`: the loader's in-memory
 * `Map` is a per-session read cache and must not end up holding 604 parsed
 * pages. The destination is the worker's versioned mushaf cache (see the
 * `runtimeCaching` route in `vite.config.ts`), which the loader then reads
 * through on any later request.
 *
 * The whole dataset is ~320 kB gzipped — less than the app bundle a member has
 * already downloaded — so this runs automatically rather than behind a setting.
 */

/** Pages pulled per idle slice. The files are tiny; this only paces the work. */
const BATCH_SIZE = 6;

/**
 * Ceiling on how long a slice waits for an idle moment before running anyway.
 * Without it a tab the browser never reports as idle would never sweep at all.
 */
const IDLE_TIMEOUT_MS = 2000;

/** Delay for browsers without `requestIdleCallback` — long enough to clear first paint. */
const IDLE_FALLBACK_MS = 1000;

export interface MushafPrefetchEnvironment {
  /** True once a worker controls this page, so a fetch is actually cached. */
  isControlled(): boolean;
  /** True while the browser believes it can reach the network. */
  isOnline(): boolean;
  /** True when the member has asked their browser to conserve data. */
  savesData(): boolean;
  /** Fetch one URL and discard it, letting the worker cache it on the way past. */
  warm(url: string): Promise<void>;
  /** Run one slice while the main thread has nothing better to do. */
  scheduleIdle(run: () => void): void;
}

export interface MushafPrefetch {
  /** Begin the sweep, or move `priority` pages ahead of whatever is left of it. */
  start(priority?: readonly number[]): void;
}

/**
 * Fetch order for the whole mushaf: the given pages first, in the order asked
 * for, then every remaining page ascending. Out-of-range and duplicate entries
 * are dropped, so a caller can pass an assigned chunk straight through.
 */
export function mushafPrefetchOrder(
  priority: readonly number[] = [],
  totalPages: number = TOTAL_QURAN_PAGES,
): number[] {
  const ordered: number[] = [];
  const seen = new Set<number>();

  const take = (page: number): void => {
    if (seen.has(page)) return;
    seen.add(page);
    ordered.push(page);
  };

  for (const page of priority) {
    if (Number.isInteger(page) && page >= 1 && page <= totalPages) take(page);
  }
  for (let page = 1; page <= totalPages; page += 1) take(page);

  return ordered;
}

/** Move already-queued URLs to the front, leaving the rest in order. */
function moveToFront(queue: readonly string[], urls: readonly string[]): string[] {
  const queued = new Set(queue);
  const promoted = [...new Set(urls)].filter((url) => queued.has(url));
  const promotedSet = new Set(promoted);
  return [...promoted, ...queue.filter((url) => !promotedSet.has(url))];
}

export function createMushafPrefetch(
  environment: MushafPrefetchEnvironment,
): MushafPrefetch {
  let queue: string[] | undefined;
  let pumping = false;

  function pump(): void {
    // Losing the connection mid-sweep parks the queue rather than draining it
    // against a dead network. The next `start` — a reader remounting, say —
    // picks up exactly where this stopped.
    if (!environment.isOnline()) {
      pumping = false;
      return;
    }

    const batch = queue?.splice(0, BATCH_SIZE) ?? [];
    if (batch.length === 0) {
      pumping = false;
      return;
    }

    // A page that fails is dropped, not retried: the next visit sweeps again,
    // and a member is never blocked on this finishing.
    void Promise.all(
      batch.map((url) => environment.warm(url).catch(() => undefined)),
    ).then(() => environment.scheduleIdle(pump));
  }

  return {
    start(priority = []) {
      // Until a worker controls the page there is nothing to cache into, and on
      // a first visit there never is one — it installs but only takes over on
      // the next open. Sweeping now would spend a member's data for nothing.
      if (!environment.isControlled()) return;
      if (environment.savesData() || !environment.isOnline()) return;

      if (queue === undefined) {
        queue = [
          ...quranMetadataUrls,
          ...mushafPrefetchOrder(priority).map(quranPageUrl),
        ];
      } else if (priority.length > 0) {
        queue = moveToFront(queue, priority.map(quranPageUrl));
      }

      if (pumping) return;
      pumping = true;
      environment.scheduleIdle(pump);
    },
  };
}

/** Chromium exposes Data Saver here; other engines simply omit it. */
interface NetworkInformation {
  saveData?: boolean;
}

const browserEnvironment: MushafPrefetchEnvironment = {
  isControlled: () =>
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker.controller !== null,

  isOnline: () => typeof navigator === 'undefined' || navigator.onLine,

  savesData: () =>
    Boolean(
      (navigator as Navigator & { connection?: NetworkInformation }).connection?.saveData,
    ),

  async warm(url) {
    const response = await fetch(url);
    // Drain the body instead of cancelling it. The worker caches its own clone
    // of the same stream, and cancelling ours would race that copy.
    await response.arrayBuffer();
  },

  scheduleIdle(run) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => run(), { timeout: IDLE_TIMEOUT_MS });
    } else {
      setTimeout(run, IDLE_FALLBACK_MS);
    }
  },
};

const prefetch = createMushafPrefetch(browserEnvironment);

/**
 * Start the background mushaf sweep, or pull `priority` pages to the front of
 * one already running. Safe to call as often as the app likes: it is a no-op
 * without a controlling worker (so also in development and tests), and only
 * ever one sweep runs.
 */
export function startMushafPrefetch(priority?: readonly number[]): void {
  prefetch.start(priority);
}
