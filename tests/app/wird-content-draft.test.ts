import { describe, expect, it } from 'vitest';
import {
  resolveWirdContent,
  wirdContentDraft,
  type WirdContentDraft,
} from '@/app/admin/wird/wirdContentDraft';
import type { QuranScopeMaps } from '@/app/admin/useQuranScopeMaps';
import { strings } from '@/content/strings.ar';
import { buildPageUnitMaps } from '@/domain/assignment';

const surahToPages: Record<number, [number, number]> = {
  1: [1, 1],
  67: [562, 564],
  112: [604, 604],
  113: [604, 604],
};
const juzToPages: Record<number, [number, number]> = {
  1: [1, 21],
  2: [22, 41],
  30: [582, 604],
};
const scopeMaps: QuranScopeMaps = {
  surahToPages,
  juzToPages,
  pageUnitMaps: buildPageUnitMaps(surahToPages, juzToPages),
};

function draft(overrides: Partial<WirdContentDraft>): WirdContentDraft {
  return { ...wirdContentDraft({ kind: 'surahs', surahIds: [] }, ''), ...overrides };
}

describe('Wird content draft', () => {
  it('seeds the editor from each stored content mode', () => {
    expect(wirdContentDraft({ kind: 'juz', juzIds: [2, 30] }, undefined)).toMatchObject({
      mode: 'juz',
      juzIds: new Set([2, 30]),
      surahIds: new Set(),
      duaText: '',
    });
    expect(wirdContentDraft({ kind: 'dua' }, 'نص')).toMatchObject({
      mode: 'dua',
      duaText: 'نص',
    });
  });

  it('resolves de-duplicated pages for any Surah or Juz combination', () => {
    expect(
      resolveWirdContent(
        draft({ mode: 'surahs', surahIds: new Set([113, 67, 112]) }),
        scopeMaps,
      ),
    ).toEqual({
      content: {
        scope: { kind: 'surahs', surahIds: [67, 112, 113] },
        pages: [562, 563, 564, 604],
      },
    });
    const juz = resolveWirdContent(
      draft({ mode: 'juz', juzIds: new Set([30, 1]) }),
      scopeMaps,
    );
    expect('content' in juz && juz.content.scope).toEqual({
      kind: 'juz',
      juzIds: [1, 30],
    });
    expect('content' in juz && juz.content.pages).toHaveLength(21 + 23);
  });

  it('keeps only the selected mode and trims the custom du’a', () => {
    expect(
      resolveWirdContent(
        draft({ mode: 'dua', surahIds: new Set([67]), duaText: '  اللهم  ' }),
        scopeMaps,
      ),
    ).toEqual({ content: { scope: { kind: 'dua' }, pages: [], duaText: 'اللهم' } });
  });

  it('explains what is missing instead of a generic failure', () => {
    expect(resolveWirdContent(draft({ mode: 'surahs' }), scopeMaps)).toEqual({
      error: strings.admin.wirdSelectionRequired,
    });
    expect(resolveWirdContent(draft({ mode: 'juz' }), scopeMaps)).toEqual({
      error: strings.admin.wirdSelectionRequired,
    });
    expect(resolveWirdContent(draft({ mode: 'dua', duaText: '   ' }), scopeMaps)).toEqual(
      {
        error: strings.admin.wirdDuaRequired,
      },
    );
    expect(
      resolveWirdContent(draft({ mode: 'surahs', surahIds: new Set([67]) }), null),
    ).toEqual({ error: strings.common.loading });
  });
});
