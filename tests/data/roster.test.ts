import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(() => ({ kind: 'roster-collection' })),
  deleteDoc: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  deleteField: vi.fn(),
  doc: vi.fn(() => ({ kind: 'person-document' })),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(() => ({ kind: 'membership-query' })),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(() => ({ kind: 'array-contains-filter' })),
}));
const khatmas = vi.hoisted(() => ({
  collection: { kind: 'khatmas-collection' },
  removeMember: vi.fn<(khatmaId: string, memberId: string) => Promise<void>>(),
}));

vi.mock('firebase/firestore', () => firestore);
vi.mock('@/data/firebase', () => ({ db: { kind: 'db' } }));
vi.mock('@/data/khatmas', () => ({
  khatmasCol: khatmas.collection,
  removeMemberFromKhatma: khatmas.removeMember,
}));

import { removePerson, subscribeRoster } from '@/data/roster';

describe('removePerson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestore.getDocs.mockResolvedValue({ docs: [{ id: 'k1' }, { id: 'k2' }] });
    khatmas.removeMember.mockResolvedValue(undefined);
    firestore.deleteDoc.mockResolvedValue(undefined);
  });

  it('cleans every khatma membership before deleting the roster document', async () => {
    await removePerson('person-1');

    expect(firestore.where).toHaveBeenCalledWith(
      'memberIds',
      'array-contains',
      'person-1',
    );
    expect(khatmas.removeMember.mock.calls).toEqual([
      ['k1', 'person-1'],
      ['k2', 'person-1'],
    ]);
    expect(firestore.deleteDoc).toHaveBeenCalledTimes(1);
    expect(khatmas.removeMember.mock.invocationCallOrder[1]).toBeLessThan(
      firestore.deleteDoc.mock.invocationCallOrder[0]!,
    );
  });

  it('keeps the roster identity when any khatma cleanup fails', async () => {
    khatmas.removeMember.mockRejectedValueOnce(new Error('cleanup failed'));

    await expect(removePerson('person-1')).rejects.toThrow('cleanup failed');
    expect(firestore.deleteDoc).not.toHaveBeenCalled();
  });
});

describe('subscribeRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes legacy people without completedPages at the read boundary', () => {
    const unsubscribe = vi.fn();
    firestore.onSnapshot.mockImplementation((_query, onChange) => {
      onChange({
        docs: [
          {
            id: 'legacy-person',
            data: () => ({
              name: 'Legacy reader',
              pagesPerDay: 2,
              enabled: true,
              createdAt: 1,
            }),
          },
        ],
      });
      return unsubscribe;
    });
    const onChange = vi.fn();

    const result = subscribeRoster(onChange);

    expect(result).toBe(unsubscribe);
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'legacy-person', completedPages: [] }),
    ]);
  });
});
