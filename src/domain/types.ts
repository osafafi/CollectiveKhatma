/**
 * Domain types — the shape of the app's data, independent of Firestore and the
 * DOM. These mirror the Firestore collections documented in ARCHITECTURE.md.
 */

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
  createdAt: number;
}

export type KhatmaStatus = 'active' | 'completed';

/** A group reading. Firestore: `khatmas/{id}` */
export interface Khatma {
  id: string;
  name?: string;
  /** Pages to split across members (default 604). */
  totalPages: number;
  /** ISO date (YYYY-MM-DD) the khatma starts. */
  startDate: string;
  durationDays: number;
  /** Roster member ids taking part. */
  memberIds: string[];
  /** When true, member-facing progress is shown without names (per-khatma). */
  anonymous: boolean;
  status: KhatmaStatus;
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
