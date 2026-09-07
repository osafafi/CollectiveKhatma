import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
const firestore = vi.hoisted(() => ({
  doc: vi.fn(() => 'content/global'),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  runTransaction: vi.fn(),
}));
vi.mock('firebase/firestore', () => firestore);
vi.mock('@/data/firebase', () => ({ db: {} }));
import { DailyDuasConflictError, setDailyDu3as, setDu3aText } from '@/data/content';

describe('daily dua persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestore.runTransaction.mockImplementation((_db, callback) => callback(transaction));
    transaction.get.mockResolvedValue({ data: () => ({ du3aText: 'khatma' }) });
  });
  it('seeds legacy content with a merge and trims prayer text', async () => {
    await setDailyDu3as([' daily '], null);
    expect(transaction.set).toHaveBeenCalledWith(
      'content/global',
      { dailyDu3as: ['daily'] },
      { merge: true },
    );
    await setDu3aText('new khatma');
    expect(firestore.setDoc).toHaveBeenCalledWith(
      'content/global',
      { du3aText: 'new khatma' },
      { merge: true },
    );
  });
  it('supports a missing document and an explicit empty list', async () => {
    transaction.get.mockResolvedValue({ data: () => undefined });
    await setDailyDu3as([], null);
    expect(transaction.set).toHaveBeenCalledWith(
      'content/global',
      { dailyDu3as: [] },
      { merge: true },
    );
  });
  it('rejects stale drafts and invalid data without writing', async () => {
    transaction.get.mockResolvedValue({ data: () => ({ dailyDu3as: ['remote'] }) });
    await expect(setDailyDu3as(['mine'], ['old'])).rejects.toBeInstanceOf(
      DailyDuasConflictError,
    );
    await expect(setDailyDu3as([' '], ['remote'])).rejects.toThrow('Invalid daily duas');
    expect(transaction.set).not.toHaveBeenCalled();
  });
});
