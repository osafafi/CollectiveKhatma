import { currentChunk, isRoundDone } from '@/domain/progress';
import type { Assignment, Khatma } from '@/domain/types';

export type QuranPageState = 'done' | 'assigned' | 'remaining';

export interface QuranPageEntry {
  page: number;
  state: QuranPageState;
  memberId?: string;
}

export interface PageGridLayout {
  left: number;
  right: number;
  top: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  columnGap: number;
  rowGap: number;
  direction: 'ltr' | 'rtl';
}

/**
 * Builds the page map from the same assignment state used by the progress
 * charts. A completed chunk wins over a current assignment; released chunks
 * never count as either read or assigned.
 */
export function buildQuranPageEntries(
  khatma: Khatma,
  assignments: readonly Assignment[],
): QuranPageEntry[] {
  const doneByPage = new Map<number, string>();
  const assignedByPage = new Map<number, string>();

  for (const assignment of assignments) {
    for (const chunk of assignment.rounds) {
      if (chunk.released === true || !isRoundDone(assignment, chunk.round)) continue;
      for (const page of chunk.pages) doneByPage.set(page, assignment.memberId);
    }

    const pending = currentChunk(assignment);
    if (pending) {
      for (const page of pending.pages) assignedByPage.set(page, assignment.memberId);
    }
  }

  return pagesInKhatma(khatma, assignments).map((page) => {
    const doneMemberId = doneByPage.get(page);
    if (doneMemberId) return { page, state: 'done', memberId: doneMemberId };

    const assignedMemberId = assignedByPage.get(page);
    if (assignedMemberId) {
      return { page, state: 'assigned', memberId: assignedMemberId };
    }

    return { page, state: 'remaining' };
  });
}

function pagesInKhatma(khatma: Khatma, assignments: readonly Assignment[]): number[] {
  if (khatma.scope.kind === 'full') {
    return pageRange(1, khatma.totalPages);
  }
  if (khatma.scope.kind === 'range') {
    return pageRange(khatma.scope.fromPage, khatma.scope.toPage);
  }

  // A surah-scoped khatma does not carry its resolved page list separately.
  // Remaining pages plus assignment history are the complete persisted scope.
  const pages = new Set(khatma.remainingPages);
  for (const assignment of assignments) {
    for (const chunk of assignment.rounds) {
      for (const page of chunk.pages) pages.add(page);
    }
  }
  return [...pages].filter((page) => page > 0).sort((a, b) => a - b);
}

function pageRange(start: number, end: number): number[] {
  const first = Math.max(1, Math.trunc(start));
  const last = Math.max(0, Math.trunc(end));
  if (last < first) return [];
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

/**
 * Linear focus falloff for boxes in the active box's row. `neighborCount`
 * controls how many boxes on each side participate in the effect.
 */
export function pageFocusScale(
  index: number,
  activeIndex: number | null,
  neighborCount: number,
  columns: number,
  maxScale: number,
): number {
  if (activeIndex === null || columns <= 0) return 1;
  if (Math.floor(index / columns) !== Math.floor(activeIndex / columns)) return 1;

  const neighbors = Math.max(0, Math.trunc(neighborCount));
  const distance = Math.abs(index - activeIndex);
  if (distance > neighbors) return 1;

  const peak = Math.max(1, maxScale);
  return 1 + (peak - 1) * (1 - distance / (neighbors + 1));
}

/** Resolve a pointer position to the untransformed page box beneath it. */
export function pageIndexAtGridPoint(
  clientX: number,
  clientY: number,
  pageCount: number,
  columns: number,
  layout: PageGridLayout,
): number | null {
  if (pageCount <= 0 || columns <= 0) return null;

  const contentLeft = layout.left + layout.paddingLeft;
  const contentRight = layout.right - layout.paddingRight;
  const contentWidth = contentRight - contentLeft;
  const cellSize = (contentWidth - Math.max(0, columns - 1) * layout.columnGap) / columns;
  if (cellSize <= 0 || clientX < contentLeft || clientX >= contentRight) return null;

  const rows = Math.ceil(pageCount / columns);
  const contentTop = layout.top + layout.paddingTop;
  const contentBottom =
    contentTop + rows * cellSize + Math.max(0, rows - 1) * layout.rowGap;
  if (clientY < contentTop || clientY >= contentBottom) return null;

  const horizontalOffset =
    layout.direction === 'rtl' ? contentRight - clientX : clientX - contentLeft;
  const column = Math.min(
    columns - 1,
    Math.floor(horizontalOffset / (cellSize + layout.columnGap)),
  );
  const row = Math.floor((clientY - contentTop) / (cellSize + layout.rowGap));
  const index = row * columns + column;
  return index < pageCount ? index : null;
}
