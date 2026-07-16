import type { Person } from './types';

/** First letter of every word in a person's display name. */
export function personInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((word) => Array.from(word)[0] ?? '')
    .join('');
}

/** The chosen emoji, or name initials when the person has not chosen one. */
export function personAvatar(person: Pick<Person, 'name' | 'emoji'>): string {
  return person.emoji?.trim() || personInitials(person.name);
}
