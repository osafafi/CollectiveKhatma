import { strings } from '@/content/strings.ar';
import { resolvePageScope } from '@/domain/assignment';
import type { PageScope } from '@/domain/types';
import type { QuranScopeMaps } from '../useQuranScopeMaps';

export type WirdMode = 'surahs' | 'juz' | 'dua';

export interface WirdContentDraft {
  mode: WirdMode;
  surahIds: ReadonlySet<number>;
  juzIds: ReadonlySet<number>;
  duaText: string;
}

export interface ResolvedWirdContent {
  scope: Extract<PageScope, { kind: WirdMode }>;
  pages: number[];
  duaText?: string;
}

/** The editable content of a Wird, read from a stored series. */
export function wirdContentDraft(
  scope: PageScope,
  duaText: string | undefined,
): WirdContentDraft {
  return {
    mode: scope.kind === 'juz' || scope.kind === 'dua' ? scope.kind : 'surahs',
    surahIds: new Set(scope.kind === 'surahs' ? scope.surahIds : []),
    juzIds: new Set(scope.kind === 'juz' ? scope.juzIds : []),
    duaText: duaText ?? '',
  };
}

/** Resolve the selected content, or the Arabic message explaining what is missing. */
export function resolveWirdContent(
  draft: WirdContentDraft,
  scopeMaps: QuranScopeMaps | null,
): { content: ResolvedWirdContent } | { error: string } {
  if (draft.mode === 'dua') {
    const duaText = draft.duaText.trim();
    return duaText
      ? { content: { scope: { kind: 'dua' }, pages: [], duaText } }
      : { error: strings.admin.wirdDuaRequired };
  }
  const ids = [...(draft.mode === 'surahs' ? draft.surahIds : draft.juzIds)].sort(
    (left, right) => left - right,
  );
  if (ids.length === 0) return { error: strings.admin.wirdSelectionRequired };
  if (!scopeMaps) return { error: strings.common.loading };
  const scope: ResolvedWirdContent['scope'] =
    draft.mode === 'surahs'
      ? { kind: 'surahs', surahIds: ids }
      : { kind: 'juz', juzIds: ids };
  try {
    const pages = resolvePageScope(scope, scopeMaps.surahToPages, scopeMaps.juzToPages);
    return pages.length > 0
      ? { content: { scope, pages } }
      : { error: strings.admin.wirdSelectionRequired };
  } catch (cause) {
    console.error('resolveWirdContent: scope resolution failed', cause);
    return { error: strings.admin.createError };
  }
}
