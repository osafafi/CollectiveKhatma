import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDistributionDraft,
  defaultDistributionAdjustments,
} from '@/domain/distributionDraft';
import { memberReliabilityScores } from '@/domain/progress';
import type { Assignment, Khatma } from '@/domain/types';

const firestore = vi.hoisted(() => ({
  collection: vi.fn((_parent: unknown, name: string) => name),
  doc: vi.fn((parent: string, ...parts: string[]) => ({
    path: parts.length ? [parent, ...parts].filter(Boolean).join('/') : `${parent}/new`,
    id: parts.at(-1) ?? 'new',
  })),
  runTransaction: vi.fn(),
}));
vi.mock('firebase/firestore', () => firestore);
vi.mock('@/data/firebase', () => ({ db: '' }));
vi.mock('@/data/khatmas', () => ({ khatmasCol: 'khatmas' }));
vi.mock('@/data/assignments', () => ({
  assignmentDoc: (id: string, memberId: string) =>
    `khatmas/${id}/assignments/${memberId}`,
}));
import { commitDistributionRun, StaleDistributionDraftError } from '@/data/distribution';

const pool = Array.from({ length: 604 }, (_, index) => index + 1);
const empty = (memberId: string): Assignment => ({
  memberId,
  rounds: [],
  doneByRound: {},
  missedStreak: 0,
});

function fixture() {
  const capacities = {
    low: { pages: 1, surahs: 0, juz: 0 },
    high: { pages: 1, surahs: 0, juz: 0 },
  };
  const current: Khatma = {
    id: 'n',
    seriesId: 'series',
    seriesName: 'Series',
    seriesNumber: 2,
    totalPages: 604,
    scope: { kind: 'full' },
    memberIds: ['low', 'high'],
    capacities,
    duaReciterId: 'low',
    status: 'active',
    remainingPages: [604],
    roundCount: 1,
    createdAt: 2,
  };
  const history: Khatma = {
    ...current,
    id: 'history',
    seriesNumber: 1,
    status: 'completed',
    duaReciterId: 'high',
    createdAt: 1,
  };
  const delivered: Assignment = {
    ...empty('high'),
    rounds: [
      {
        round: 1,
        date: '2026-08-01',
        pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        loosePages: [],
        redistributedPages: [],
      },
    ],
    doneByRound: { 1: Date.UTC(2026, 7, 1) },
  };
  const scores = memberReliabilityScores(
    current.memberIds.map((id) => ({ id })),
    [delivered],
  );
  const members = current.memberIds.map((id) => ({
    id,
    capacity: capacities[id as keyof typeof capacities],
    completedPages: id === 'high' ? [604] : [],
    enabled: true,
    holdPages: false,
    reliabilityScore: scores[id]!.grade,
  }));
  const states = [
    {
      id: 'n',
      seriesNumber: 2,
      remainingPages: [604],
      roundCount: 1,
      assignments: current.memberIds.map(empty),
    },
  ];
  const adjustments = defaultDistributionAdjustments();
  const preview = buildDistributionDraft({
    mode: 'new-round',
    khatmas: states,
    members,
    newKhatmaPool: pool,
    newKhatmaSeriesNumber: 3,
    adjustments,
  });
  const documents: Record<string, unknown> = {
    'khatmas/n': current,
    'khatmas/history': history,
    'khatmas/history/assignments/high': delivered,
    ...Object.fromEntries(
      members.map((member) => [`roster/${member.id}`, { ...member, pagesPerDay: 1 }]),
    ),
  };
  const tx = {
    get: vi.fn(async (ref: string | { path: string }) => {
      const path = typeof ref === 'string' ? ref : ref.path;
      return { exists: () => documents[path] !== undefined, data: () => documents[path] };
    }),
    set: vi.fn(),
    update: vi.fn(),
  };
  firestore.runTransaction.mockImplementation(
    async (_db: unknown, run: (transaction: typeof tx) => Promise<unknown>) => run(tx),
  );
  const params = {
    khatmaIds: ['n'],
    historyKhatmaIds: ['n', 'history'],
    mode: 'new-round' as const,
    expectedSourceRevision: preview.sourceRevision,
    adjustments,
    today: '2026-09-14',
    rolloverSeed: {
      seriesId: 'series',
      seriesName: 'Series',
      seriesNumber: 3,
      totalPages: 604,
      scope: { kind: 'full' as const },
      memberIds: current.memberIds,
      capacities,
      duaReciterId: 'high',
      pool,
    },
  };
  return { tx, params, documents, preview };
}

describe('confirmed reliability distribution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rebuilds scores from historical assignments and rotates the persisted rollover reciter', async () => {
    const { tx, params } = fixture();
    await commitDistributionRun(params);
    expect(tx.set).toHaveBeenCalledWith(
      'khatmas/n/assignments/high',
      expect.objectContaining({ rounds: [expect.objectContaining({ pages: [604] })] }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      'khatmas/new/assignments/low',
      expect.objectContaining({
        rounds: [expect.objectContaining({ pages: [1, 2, 3] })],
      }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'khatmas/new' }),
      expect.objectContaining({ duaReciterId: 'high' }),
    );
    expect(tx.get.mock.invocationCallOrder.at(-1)).toBeLessThan(
      tx.set.mock.invocationCallOrder[0]!,
    );
  });

  it('persists an explicit rollover target while keeping the old pool intact', async () => {
    const { tx, params } = fixture();
    params.adjustments.members = {
      high: { targetKhatmaId: null },
      low: { include: false },
    };
    await commitDistributionRun(params);
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'khatmas/n' }),
      expect.objectContaining({ remainingPages: [604] }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      'khatmas/n/assignments/high',
      expect.objectContaining({ rounds: [] }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      'khatmas/new/assignments/high',
      expect.objectContaining({
        rounds: [expect.objectContaining({ pages: [1, 2, 3] })],
      }),
    );
  });

  it('rejects changed historical scores without writing', async () => {
    const { tx, params, documents } = fixture();
    documents['khatmas/history/assignments/high'] = empty('high');
    await expect(commitDistributionRun(params)).rejects.toBeInstanceOf(
      StaleDistributionDraftError,
    );
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects a changed manual reciter before rollover writes', async () => {
    const { tx, params, documents } = fixture();
    documents['khatmas/n'] = {
      ...(documents['khatmas/n'] as Khatma),
      duaReciterId: 'high',
    };
    await expect(commitDistributionRun(params)).rejects.toMatchObject({
      reason: 'rollover-metadata',
    });
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });
});
