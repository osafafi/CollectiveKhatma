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
   * khatma. Drives the "don't reassign already-completed pages" rotation
   * (REQUIREMENTS §4, §5).
   */
  completedPages: number[];
  /**
   * How many pages this person can read per day — their capacity in the
   * assignment algorithm. Admin-set when adding them, editable at any time
   * (e.g. 1, 5, or ~20 for a juz). Defaults to {@link DEFAULT_PAGES_PER_DAY}.
   */
  pagesPerDay: number;
  /**
   * When `false`, the person is temporarily paused (e.g. menstruation) and is
   * excluded from assignment across all their khatmas until re-enabled, without
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
 * {@link Khatma} so the pool can be re-derived for leftover calc + re-planning.
 */
export type PageScope =
  | { kind: 'full'; totalPages?: number }
  | { kind: 'range'; fromPage: number; toPage: number }
  | { kind: 'surahs'; surahIds: number[] };

/** A group reading. Firestore: `khatmas/{id}` */
export interface Khatma {
  id: string;
  name?: string;
  /** Pages to split across members (default 604). Equals the resolved scope size. */
  totalPages: number;
  /** What this khatma covers — re-resolved for leftover calc + re-planning. */
  scope: PageScope;
  /** ISO date (YYYY-MM-DD) the khatma starts. */
  startDate: string;
  durationDays: number;
  /** Roster member ids taking part. */
  memberIds: string[];
  /** When true, member-facing progress is shown without names (per-khatma). */
  anonymous: boolean;
  status: KhatmaStatus;
  /**
   * The single member designated to recite du3a2 al-khatma for THIS khatma.
   * Chosen by rotation at creation so the duty spreads across cycles
   * (REQUIREMENTS §7, updated). Optional for legacy docs.
   */
  duaReciterId?: string;
  /** Epoch ms when the admin marked the khatma completed (drives the log). */
  completedAt?: number;
  createdAt: number;
}

/**
 * One member's page assignment within a khatma.
 * Firestore: `khatmas/{khatmaId}/assignments/{memberId}`
 */
export interface Assignment {
  memberId: string;
  /** Page numbers per day: `pagesByDay[dayIndex]` = pages for that day. */
  pagesByDay: number[][];
  /** `dayIndex` -> completedAt timestamp. A present key means that day is done. */
  doneByDay: Record<number, number>;
}

/** Global, admin-editable content. Firestore: `content/global` */
export interface GlobalContent {
  /** du3a2 al-khatma shown on completion (REQUIREMENTS §7). */
  du3aText: string;
}
