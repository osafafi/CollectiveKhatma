import type { Person } from './types';

export interface AssignmentInput {
  /** Pages to split (default 604). */
  totalPages: number;
  durationDays: number;
  /** Members taking part, with their lifetime completed pages (for rotation). */
  members: ReadonlyArray<Pick<Person, 'id' | 'completedPages'>>;
}

/** memberId -> pagesByDay (`pages[dayIndex]` = page numbers for that day). */
export type AssignmentResult = Record<string, number[][]>;

/**
 * Auto-assign pages across members, as evenly as possible per day, avoiding
 * pages each member has already completed in past khatmas (REQUIREMENTS §5).
 *
 * STUB — implemented in Stage 2 (feature work). Kept here with its final
 * signature so the data and UI layers can be wired against it now.
 */
export function generateAssignments(_input: AssignmentInput): AssignmentResult {
  throw new Error('generateAssignments: not implemented yet (Stage 2)');
}
