import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Assignment, Khatma } from '@/domain/types';

const firestore = vi.hoisted(() => ({
  collection: vi.fn((_parent: unknown, name: string) => ({ kind: name })),
  doc: vi.fn((_parent: unknown, id?: string) => ({ kind: 'khatma', id })),
  runTransaction: vi.fn(),
  arrayUnion: vi.fn(),
  deleteField: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestore);
vi.mock('@/data/firebase', () => ({ db: { kind: 'db' } }));
vi.mock('@/data/assignments', () => ({
  assignmentDoc: (khatmaId: string, memberId: string) => ({
    kind: 'assignment',
    khatmaId,
    memberId,
  }),
  assignmentsCol: vi.fn(),
  emptyAssignment: (memberId: string) => ({
    memberId,
    rounds: [],
    doneByRound: {},
    missedStreak: 0,
  }),
}));

import { assignRemainingPages } from '@/data/khatmas';

describe('assignRemainingPages data transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1234);
  });

  it('atomically drains the khatma pool and appends the manual assignment', async () => {
    const khatma: Omit<Khatma, 'id'> = {
      seriesId: 'series',
      seriesName: 'Series',
      seriesNumber: 1,
      totalPages: 604,
      scope: { kind: 'full' },
      memberIds: ['admin'],
      capacities: { admin: { pages: 2, surahs: 0, juz: 0 } },
      status: 'active',
      remainingPages: [603, 604],
      roundCount: 8,
      duaReciterId: 'admin',
      createdAt: 1,
    };
    const assignment: Assignment = {
      memberId: 'admin',
      rounds: [],
      doneByRound: {},
      missedStreak: 0,
    };
    const update = vi.fn();
    const set = vi.fn();
    const tx = {
      get: vi.fn(async (ref: { kind: string }) => ({
        exists: () => true,
        data: () => (ref.kind === 'assignment' ? assignment : khatma),
      })),
      update,
      set,
    };
    firestore.runTransaction.mockImplementation(
      async (_db: unknown, run: (transaction: typeof tx) => Promise<void>) => run(tx),
    );

    await assignRemainingPages('khatma', 'admin', '2026-08-12');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'khatma', id: 'khatma' }),
      {
        remainingPages: [],
        roundCount: 9,
        lastDistributionDate: '2026-08-12',
      },
    );
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'assignment', memberId: 'admin' }),
      expect.objectContaining({
        memberId: 'admin',
        rounds: [
          expect.objectContaining({
            id: 'manual-remainder:1234:admin',
            round: 9,
            pages: [603, 604],
          }),
        ],
      }),
    );
  });
});
