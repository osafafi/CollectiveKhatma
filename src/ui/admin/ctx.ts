/**
 * Shared admin-app context: live Firestore state + persistent form drafts +
 * the rerender trigger. Defined apart from render.ts so the page modules can
 * import it without a circular dependency.
 */
import type {
  Assignment,
  GlobalContent,
  Khatma,
  MemberCapacity,
  PageScope,
  Person,
} from '@/domain/types';
import type { PageUnitMaps } from '@/domain/assignment';
import type { Surah } from '@/content/quran/types';

export interface AdminState {
  roster: Person[];
  khatmas: Khatma[];
  /** khatmaId -> live assignment docs (active khatmas + the one being viewed). */
  assignments: Map<string, Assignment[]>;
  content?: GlobalContent;
  surahToPages?: Record<number, [number, number]>;
  /** All 114 surahs with Arabic names + page spans (for the name-based picker). */
  surahs?: Surah[];
  /** page -> surah/juz lookups for whole-surah / whole-juz capacities. */
  pageUnitMaps?: PageUnitMaps;
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
  /** Whether the create form is revealed (list-first; a button opens it). */
  showCreateForm: boolean;
  seriesName: string;
  scopeKind: PageScope['kind'];
  rangeFrom: string;
  rangeTo: string;
  /** Selected surah ids for a "specific surahs" scope (chosen by name). */
  surahIds: Set<number>;
  memberIds: Set<string>;
  /** Per-member additive capacity for the khatma being created (memberId -> cap). */
  memberCaps: Record<string, MemberCapacity>;
  reciterId: string; // '' = auto (rotation)
  /** Backfill: creation date (YYYY-MM-DD, '' = today) and series number ('' = auto). */
  createdDate: string;
  seriesNumberOverride: string;
  createError: string;
  // Du3a editor
  du3aText: string;
  du3aTouched: boolean;
  du3aStatus: string;
  /** Per-khatma edit-form fields (khatmaId -> draft), seeded from the khatma. */
  editKhatma: Record<string, { name: string; number: string; date: string }>;
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
    showCreateForm: false,
    seriesName: '',
    scopeKind: 'full',
    rangeFrom: '1',
    rangeTo: '604',
    surahIds: new Set(),
    memberIds: new Set(),
    memberCaps: {},
    reciterId: '',
    createdDate: '',
    seriesNumberOverride: '',
    createError: '',
    du3aText: '',
    du3aTouched: false,
    du3aStatus: '',
    editKhatma: {},
    status: {},
    busy: new Set(),
  };
}
