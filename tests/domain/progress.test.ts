import { describe, expect, it } from 'vitest';
import {
  assignedPageCount,
  donePageCount,
  hasUnreadPages,
  isDayDone,
  khatmaProgress,
  pendingForDay,
  pendingReaders,
} from '@/domain/progress';
import type { Assignment } from '@/domain/types';

// Partly done: days 0-1 read, day 2 (page 5) still pending.
const partly: Assignment = {
  memberId: 'a',
  pagesByDay: [[1, 2], [3, 4], [5]],
  doneByDay: { 0: 1_000, 1: 2_000 },
};

// Fully done.
const finished: Assignment = {
  memberId: 'b',
  pagesByDay: [[10, 11]],
  doneByDay: { 0: 3_000 },
};

// Nothing done yet (empty done map — the fresh-khatma shape).
const fresh: Assignment = {
  memberId: 'c',
  pagesByDay: [[20], [21]],
  doneByDay: {},
};

describe('per-assignment progress', () => {
  it('reads day-done marks', () => {
    expect(isDayDone(partly, 0)).toBe(true);
    expect(isDayDone(partly, 2)).toBe(false);
    expect(isDayDone(fresh, 0)).toBe(false);
  });

  it('counts assigned vs completed pages', () => {
    expect(assignedPageCount(partly)).toBe(5);
    expect(donePageCount(partly)).toBe(4); // pages on days 0 and 1
    expect(donePageCount(finished)).toBe(2);
    expect(donePageCount(fresh)).toBe(0);
  });

  it('detects leftover unread pages', () => {
    expect(hasUnreadPages(partly)).toBe(true);
    expect(hasUnreadPages(finished)).toBe(false);
    expect(hasUnreadPages(fresh)).toBe(true);
  });
});

describe('khatmaProgress', () => {
  it('aggregates group completion and flags a finished khatma', () => {
    const progress = khatmaProgress([partly, finished]);
    expect(progress.donePages).toBe(6);
    expect(progress.totalPages).toBe(7);
    expect(progress.percent).toBe(86); // round(6/7)
    expect(progress.complete).toBe(false);

    expect(khatmaProgress([finished]).complete).toBe(true);
  });

  it('is safe for a khatma with no assignments', () => {
    expect(khatmaProgress([])).toEqual({
      donePages: 0,
      totalPages: 0,
      percent: 0,
      complete: false,
    });
  });
});

describe('pending readers', () => {
  it('lists members who have pages for a day but have not marked it done', () => {
    expect(pendingForDay([partly, finished], 0)).toEqual([]); // both done day 0
    expect(pendingForDay([partly, finished], 2)).toEqual(['a']); // only a has day-2 pages, undone
    expect(pendingForDay([fresh], 0)).toEqual(['c']);
  });

  it('lists everyone with any unread pages (admin §8 list)', () => {
    expect(pendingReaders([partly, finished, fresh])).toEqual(['a', 'c']);
  });
});
