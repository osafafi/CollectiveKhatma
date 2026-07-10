/**
 * Domain types — the shape of the app's data, independent of Firestore and the
 * DOM. These mirror the Firestore collections documented in ARCHITECTURE.md.
 */

/**
 * Daily page capacity assumed for a person when the admin hasn't set one
 * explicitly (legacy roster docs predate the field). See {@link Person.pagesPerDay}.
 */
export const DEFAULT_PAGES_PER_DAY = 2;

/** A person in the global roster. Firestore: `roster/{id}` */
export interface Person {
  id: string;
  /** Display name — unique across the whole roster (enforced at creation). */
  name: string;
  /** Free-form note (e.g. "husband of Sara"); metadata only, never identity. */
  note?: string;
  /**
   * Lifetime set of page numbers this person has marked done, across every
   * khatma. Feeds the personal "pages of the Quran read" insight only —
   * distribution is front-of-pool sequential and does not consult it.
   */
  completedPages: number[];
  /**
   * How many pages this person receives per distribution round — their chunk
   * size. Admin-set when adding them, editable at any time (e.g. 1, 5, or ~20
   * for a juz). Defaults to {@link DEFAULT_PAGES_PER_DAY}.
   */
  pagesPerDay: number;
  /**
   * When `false`, the person is temporarily paused (e.g. menstruation) and is
   * skipped by distribution across all their khatmas until re-enabled, without
   * being removed from the roster. Defaults to `true`.
   */
  enabled: boolean;
  createdAt: number;
}

export type KhatmaStatus = 'active' | 'completed';

/**
 * What a khatma should cover. The admin picks one of these; the UI resolves it
 * to a flat page pool with `resolvePageScope` (see `assignment.ts`) — the full
 * mushaf, a page range, or whole chapters (REQUIREMENTS §5). Stored on the
 * {@link Khatma} so the next khatma in the series can re-derive its pool at
 * rollover.
 */
export type PageScope =
  | { kind: 'full'; totalPages?: number }
  | { kind: 'range'; fromPage: number; toPage: number }
  | { kind: 'surahs'; surahIds: number[] };

/**
 * A group reading. Firestore: `khatmas/{id}`
 *
 * Khatmas are open-ended (no fixed duration): pages are handed out in
 * admin-triggered distribution rounds and the khatma completes when every page
 * has been read. Khatmas belong to a named series ("أهل القرآن 1", "… 2", …);
 * when a pool drains mid-round, distribution seals khatma N and auto-creates
 * N+1, so two khatmas of a series can briefly coexist (REQUIREMENTS §5).
 *
 * Invariants (see also CLAUDE.md):
 * 1. Every scope page is in exactly one of: a non-released assignment chunk,
 *    or `remainingPages`.
 * 2. `remainingPages` is always ascending; distribution shifts from the front;
 *    released pages merge back in sorted position (so they re-serve first).
 * 3. `lastDistributionDate === today` blocks another distribution today.
 */
export interface Khatma {
  id: string;
  /** Stable across the whole series; minted when the series is first created. */
  seriesId: string;
  /** Series display name (e.g. "أهل القرآن") — the number is appended in the UI. */
  seriesName: string;
  /** 1-based position in the series; incremented at each rollover. */
  seriesNumber: number;
  /** Pages the khatma covers (default 604). Equals the resolved scope size. */
  totalPages: number;
  /** What this khatma covers — re-resolved to seed the next khatma at rollover. */
  scope: PageScope;
  /** Roster member ids taking part. */
  memberIds: string[];
  /** When true, member-facing progress is shown without names (per-khatma). */
  anonymous: boolean;
  status: KhatmaStatus;
  /** Pages not yet held by any live chunk, ascending. Starts as the full pool. */
  remainingPages: number[];
  /** How many distribution rounds have run against THIS khatma. */
  roundCount: number;
  /** ISO date (YYYY-MM-DD) of the last distribution — same-day idempotency guard. */
  lastDistributionDate?: string;
  /**
   * The single member designated to recite du3a2 al-khatma for THIS khatma.
   * Chosen by rotation at creation/rollover so the duty spreads across cycles
   * (REQUIREMENTS §7). Optional for legacy docs.
   */
  duaReciterId?: string;
  /** Epoch ms when the khatma was marked completed (drives the series history). */
  completedAt?: number;
  createdAt: number;
}

/**
 * One chunk of pages handed to a member in one distribution round.
 * Append-only history on the {@link Assignment}.
 */
export interface RoundChunk {
  /** Khatma-local round number, 1-based (matches `Khatma.roundCount` sequence). */
  round: number;
  /** ISO date (YYYY-MM-DD) the chunk was distributed. */
  date: string;
  /** Ascending page numbers; may be empty (pool drained that round). */
  pages: number[];
  /**
   * Set when the member missed the round: the pages were returned to the pool
   * and reassigned. The chunk is kept as history; it can never be marked done.
   */
  released?: true;
}

/**
 * One member's assignment history within a khatma.
 * Firestore: `khatmas/{khatmaId}/assignments/{memberId}`
 *
 * Invariant: only the LAST chunk with `pages.length > 0` may be pending
 * (neither done nor released) — distribution settles every earlier chunk.
 */
export interface Assignment {
  memberId: string;
  /** Distribution history, append-only, one entry per round the member was served. */
  rounds: RoundChunk[];
  /** `round` -> completedAt epoch ms. A present key means that round is done. */
  doneByRound: Record<number, number>;
  /** Consecutive missed rounds; 0 = clean. Drives the warning level. */
  missedStreak: number;
}

/**
 * Admin-facing warning derived from {@link Assignment.missedStreak}:
 * 0 → none, 1 → yellow (⚠), 2+ → red. Cleared by the admin at any time by
 * resetting the streak to 0.
 */
export type WarningLevel = 'none' | 'yellow' | 'red';

/** Global, admin-editable content. Firestore: `content/global` */
export interface GlobalContent {
  /** du3a2 al-khatma shown on completion (REQUIREMENTS §7). */
  du3aText: string;
}
