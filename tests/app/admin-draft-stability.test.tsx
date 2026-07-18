import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminExperience } from '@/app/admin/AdminApp';
import { writeOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import type { QuranIndex, Surah } from '@/content/quran/types';
import type { Assignment, Khatma, Person } from '@/domain/types';
import {
  renderWithAppProviders,
  type RenderWithAppProvidersOptions,
} from '../support/reactTestHarness';

/**
 *  — one consolidated proof that a live Firestore snapshot arriving mid-
 * interaction never clobbers an in-progress admin draft or closes an open form.
 *
 * Covers the three admin drafts that seed or
 * accumulate local state — the khatmas create form, the khatma-detail edit card,
 * and the roster add-person form — and **P4** search caret/focus survival across
 * a live snapshot. **P3** (the settings du3a touched guard) is proven in
 * `admin-settings.test.tsx`; the same store-driven re-render is what these assert.
 */

const loader = vi.hoisted(() => ({
  getQuranIndex: vi.fn<() => Promise<QuranIndex>>(),
  getSurahs: vi.fn<() => Promise<Surah[]>>(),
}));
vi.mock('@/content/quran/loader', () => loader);

const INDEX: QuranIndex = {
  totalPages: 604,
  surahToPages: { 1: [1, 1], 2: [2, 49] },
  juzToPages: { 1: [1, 21] },
};
const SURAHS: Surah[] = [
  {
    id: 1,
    name: 'الفاتحة',
    pageStart: 1,
    pageEnd: 1,
    versesCount: 7,
    bismillahPre: false,
    revelation: 'meccan',
  },
];

const amina: Person = {
  id: 'p1',
  name: 'Amina',
  completedPages: [],
  pagesPerDay: 2,
  enabled: true,
  createdAt: 1,
};
const maryam: Person = { ...amina, id: 'p2', name: 'Maryam' };

function makeKhatma(id: string, overrides: Partial<Khatma> = {}): Khatma {
  return {
    id,
    seriesId: `series-${id}`,
    seriesName: 'أهل القرآن',
    seriesNumber: 1,
    totalPages: 6,
    scope: { kind: 'range', fromPage: 1, toPage: 6 },
    memberIds: [amina.id],
    capacities: {
      [amina.id]: { pages: 2, surahs: 0, juz: 0 },
      [maryam.id]: { pages: 2, surahs: 0, juz: 0 },
    },
    duaReciterId: amina.id,
    status: 'active',
    remainingPages: [1, 2, 3, 4, 5, 6],
    roundCount: 1,
    createdAt: Date.UTC(2026, 6, 1),
    ...overrides,
  };
}

function makeAssignment(memberId: string): Assignment {
  return { memberId, rounds: [], doneByRound: {}, missedStreak: 0 };
}

function render(route: string, data: RenderWithAppProvidersOptions['data']) {
  return renderWithAppProviders(<AdminExperience />, {
    route,
    data,
    operations: { ...writeOperations, createKhatma: vi.fn().mockResolvedValue('new') },
  });
}

describe('admin form-draft stability under live snapshots', () => {
  beforeEach(() => {
    loader.getQuranIndex.mockReset();
    loader.getQuranIndex.mockResolvedValue(INDEX);
    loader.getSurahs.mockReset();
    loader.getSurahs.mockResolvedValue(SURAHS);
  });

  it('P2 — an unrelated khatmas snapshot does not clobber or close the create form', async () => {
    const { user, subscriptions } = render('/khatmas', { roster: [amina], khatmas: [] });

    await user.click(screen.getByRole('button', { name: strings.admin.createNewButton }));
    const nameField = screen.getByLabelText(strings.admin.seriesNamePlaceholder);
    await user.type(nameField, 'أهل الذكر');
    await user.click(screen.getByRole('checkbox', { name: amina.name }));

    // A different khatma is created elsewhere and streams in.
    subscriptions.khatmas.emit([makeKhatma('other', { seriesName: 'سلسلة أخرى' })]);

    // The typed name, the checked member, and the open form all survive.
    expect(screen.getByLabelText(strings.admin.seriesNamePlaceholder)).toHaveValue(
      'أهل الذكر',
    );
    expect(screen.getByRole('checkbox', { name: amina.name })).toBeChecked();
    expect(
      screen.getByRole('button', { name: strings.admin.createButton }),
    ).toBeVisible();
  });

  it('P2 — a snapshot renaming the khatma does not overwrite an in-progress edit', async () => {
    const { user, subscriptions } = render('/khatmas/k', {
      roster: [amina],
      khatmas: [makeKhatma('k', { seriesName: 'أهل القرآن' })],
      assignments: { k: [makeAssignment(amina.id)] },
    });

    const nameField = screen.getByLabelText(strings.admin.seriesNamePlaceholder);
    await user.clear(nameField);
    await user.type(nameField, 'أهل الذكر');

    // A concurrent rename streams in with a third value.
    subscriptions.khatmas.emit([makeKhatma('k', { seriesName: 'اسم من الخادم' })]);

    // The edit card keeps the admin's in-progress text (seeded once, P2)…
    expect(screen.getByLabelText(strings.admin.seriesNamePlaceholder)).toHaveValue(
      'أهل الذكر',
    );
    // …while the live header reflects the incoming snapshot.
    expect(screen.getByRole('heading', { name: 'اسم من الخادم ١' })).toBeVisible();
  });

  it('P2 — a roster snapshot does not clobber the add-person draft', async () => {
    const { user, subscriptions } = render('/roster', { roster: [amina], khatmas: [] });

    const nameField = screen.getByLabelText(strings.admin.namePlaceholder);
    await user.type(nameField, 'سارة');

    // Someone else is added to the roster and streams in.
    subscriptions.roster.emit([amina, maryam]);

    expect(screen.getByLabelText(strings.admin.namePlaceholder)).toHaveValue('سارة');
    // The live list did update, so this is a genuine re-render, not a no-op.
    expect(screen.getByText('Maryam')).toBeVisible();
  });

  it('P4 — search caret and focus survive a live roster snapshot', async () => {
    const { user, subscriptions } = render('/roster', {
      roster: [amina, maryam],
      khatmas: [],
    });

    const search = screen.getByRole('searchbox', {
      name: strings.admin.searchPlaceholder,
    });
    await user.click(search);
    await user.type(search, 'Am');
    expect(screen.getByText('Amina')).toBeVisible();
    expect(screen.queryByText('Maryam')).toBeNull();

    // A live roster snapshot arrives while the query is focused.
    subscriptions.roster.emit([amina, maryam, { ...amina, id: 'p3', name: 'Amal' }]);

    // The controlled field never remounts: focus and query are preserved…
    expect(search).toHaveFocus();
    expect(search).toHaveValue('Am');
    // …and the filter re-applies against the fresh snapshot.
    expect(screen.getByText('Amal')).toBeVisible();
  });
});
