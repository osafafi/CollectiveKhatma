import { describe, expect, it } from 'vitest';
import { personAvatar, personInitials } from '@/domain/personAppearance';

describe('person appearance', () => {
  it('derives the first letter of every word when no emoji is selected', () => {
    expect(personInitials('  Amina Noor Ali  ')).toBe('ANA');
    expect(personInitials('أمينة نور')).toBe('أن');
    expect(personAvatar({ name: 'Amina Noor' })).toBe('AN');
  });

  it('prefers a selected emoji over initials', () => {
    expect(personAvatar({ name: 'Amina Noor', emoji: ' 🌷 ' })).toBe('🌷');
  });
});
