import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Khatma } from '@/domain/types';

const firestore = vi.hoisted(() => ({
  arrayRemove: vi.fn(),
  arrayUnion: vi.fn((...values: unknown[]) => ({ union: values })),
  collection: vi.fn((parent: { path?: string }, name: string) => ({
    path: `${parent.path ?? 'db'}/${name}`,
  })),
  deleteField: vi.fn(),
  doc: vi.fn((parent: { path?: string }, ...parts: string[]) => ({
    path: `${parent.path ?? 'db'}/${parts.length > 0 ? parts.join('/') : 'generated'}`,
    id: parts.at(-1) ?? 'generated',
  })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestore);
vi.mock('@/data/firebase', () => ({ db: { path: 'db' } }));

import { completeWirdDay, createWird, updateWird } from '@/data/wirds';

describe('Wird data adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a single-member indefinite series with fixed Quran pages', async () => {
    const set = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    firestore.writeBatch.mockReturnValue({ set, commit });

    await createWird({
      seriesId: 'series-wird',
      seriesName: 'ورد الملك',
      seriesNumber: 1,
      memberId: 'p1',
      scope: { kind: 'surahs', surahIds: [67] },
      pages: [562, 563, 564],
      createdAt: 10,
    });

    expect(set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: 'wird',
        memberIds: ['p1'],
        pastMemberIds: [],
        status: 'active',
        scope: { kind: 'surahs', surahIds: [67] },
        remainingPages: [562, 563, 564],
        totalPages: 3,
        completionCount: 0,
      }),
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('writes one immutable day and increments the Wird counter', async () => {
    const wird: Omit<Khatma, 'id'> = {
      kind: 'wird',
      seriesId: 'series-wird',
      seriesName: 'ورد الملك',
      seriesNumber: 1,
      totalPages: 3,
      scope: { kind: 'surahs', surahIds: [67] },
      memberIds: ['p1'],
      pastMemberIds: [],
      capacities: { p1: { pages: 0, surahs: 0, juz: 0 } },
      status: 'active',
      remainingPages: [562, 563, 564],
      roundCount: 4,
      completionCount: 4,
      duaReciterId: '',
      createdAt: 1,
    };
    const set = vi.fn();
    const update = vi.fn();
    const tx = {
      get: vi.fn(async (ref: { path: string }) =>
        ref.path.endsWith('/w1')
          ? { exists: (): boolean => true, data: () => wird }
          : { exists: (): boolean => false },
      ),
      set,
      update,
    };
    firestore.runTransaction.mockImplementation(
      async (_db: unknown, run: (transaction: typeof tx) => Promise<void>) => run(tx),
    );

    await completeWirdDay({
      wirdId: 'w1',
      memberId: 'p1',
      date: '2026-10-18',
      completedAt: 1234,
      contentKind: 'quran',
      pages: [562, 563, 564],
    });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('wirdCompletions') }),
      {
        memberId: 'p1',
        date: '2026-10-18',
        completedAt: 1234,
        contentKind: 'quran',
        pages: [562, 563, 564],
      },
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringMatching(/\/w1$/) }),
      { completionCount: 5, roundCount: 5, lastDistributionDate: '2026-10-18' },
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('/roster/p1') }),
      { completedPages: { union: [562, 563, 564] } },
    );
  });

  it('preserves the former member when the admin changes member and content', async () => {
    const wird: Omit<Khatma, 'id'> = {
      kind: 'wird',
      seriesId: 'series-wird',
      seriesName: 'ورد الملك',
      seriesNumber: 1,
      totalPages: 3,
      scope: { kind: 'surahs', surahIds: [67] },
      memberIds: ['p1'],
      pastMemberIds: ['p0'],
      capacities: { p1: { pages: 0, surahs: 0, juz: 0 } },
      status: 'active',
      remainingPages: [562, 563, 564],
      roundCount: 4,
      completionCount: 4,
      duaReciterId: '',
      createdAt: 1,
    };
    const update = vi.fn();
    const tx = {
      get: vi.fn(async () => ({ exists: (): boolean => true, data: () => wird })),
      update,
    };
    firestore.runTransaction.mockImplementation(
      async (_db: unknown, run: (transaction: typeof tx) => Promise<void>) => run(tx),
    );

    await updateWird('w1', {
      memberId: 'p2',
      scope: { kind: 'dua' },
      pages: [],
      duaText: 'دعاء يومي جديد',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringMatching(/\/w1$/) }),
      expect.objectContaining({
        memberIds: ['p2'],
        pastMemberIds: ['p0', 'p1'],
        scope: { kind: 'dua' },
        remainingPages: [],
        totalPages: 0,
        wirdDuaText: 'دعاء يومي جديد',
      }),
    );
  });
});
