import type { Person } from './types';

/** Collapse surrounding/duplicate whitespace so names compare consistently. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * True if `name` is not already taken by someone in the roster. Names must be
 * unique across the whole roster (REQUIREMENTS §4). Comparison is
 * whitespace-normalized.
 */
export function isNameUnique(
  name: string,
  roster: ReadonlyArray<Pick<Person, 'name'>>,
): boolean {
  const target = normalizeName(name);
  return !roster.some((p) => normalizeName(p.name) === target);
}
