import type { Person } from './types';

/** Collapse surrounding/duplicate whitespace so names compare consistently. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Canonical form used only for identity comparisons; display casing is preserved. */
export function canonicalName(name: string): string {
  return normalizeName(name).toLowerCase();
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
  const target = canonicalName(name);
  return !roster.some((p) => canonicalName(p.name) === target);
}
