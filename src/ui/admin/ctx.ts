/**
 * Shared admin-app context: live Firestore state + persistent form drafts +
 * the rerender trigger. Defined apart from render.ts so the page modules can
 * import it without a circular dependency.
 */
import type { Assignment, GlobalContent, Khatma, PageScope, Person } from '@/domain/types';

export interface AdminState {
  roster: Person[];
  khatmas: Khatma[];
  /** khatmaId -> live assignment docs (active khatmas + the one being viewed). */
  assignments: Map<string, Assignment[]>;
  content?: GlobalContent;
  surahToPages?: Record<number, [number, number]>;
}

/** Form fields live here so their values survive rerenders. */
export interface AdminDraft {
  // Roster tab
  newName: string;
  newNote: string;
  newPagesPerDay: string;
  addError: string;
  search: string;
  // Create-khatma form
  seriesName: string;
  scopeKind: PageScope['kind'];
  rangeFrom: string;
  rangeTo: string;
  surahsText: string;
  memberIds: Set<string>;
  reciterId: string; // '' = auto (rotation)
  createError: string;
  // Du3a editor
  du3aText: string;
  du3aTouched: boolean;
  du3aStatus: string;
  /** Transient per-entity messages, keyed by seriesId or khatmaId. */
  status: Record<string, string>;
  /** Series ids with a distribution in flight (disables the button). */
  busy: Set<string>;
}

export interface AdminCtx {
  state: AdminState;
  draft: AdminDraft;
  rerender: () => void;
}

export function initialDraft(): AdminDraft {
  return {
    newName: '',
    newNote: '',
    newPagesPerDay: '2',
    addError: '',
    search: '',
    seriesName: '',
    scopeKind: 'full',
    rangeFrom: '1',
    rangeTo: '604',
    surahsText: '',
    memberIds: new Set(),
    reciterId: '',
    createError: '',
    du3aText: '',
    du3aTouched: false,
    du3aStatus: '',
    status: {},
    busy: new Set(),
  };
}
