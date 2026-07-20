import { describe, expect, it } from 'vitest';
import { isNameUnique, normalizeName } from '@/domain/validation';
import { khatmaPercent, lifetimePercent } from '@/domain/progress';
import {
  FEEDBACK_MAX_CHARACTERS,
  FEEDBACK_MIN_CHARACTERS,
  isValidFeedbackMessage,
  normalizeFeedbackMessage,
} from '@/domain/feedback';

describe('validation', () => {
  const roster = [{ name: 'فاطمة' }, { name: 'مريم' }];

  it('rejects a name already in the roster', () => {
    expect(isNameUnique('فاطمة', roster)).toBe(false);
  });

  it('accepts a new name', () => {
    expect(isNameUnique('خديجة', roster)).toBe(true);
  });

  it('normalizes whitespace before comparing', () => {
    expect(isNameUnique('  فاطمة  ', roster)).toBe(false);
    expect(normalizeName('  a   b  ')).toBe('a b');
  });

  it('compares names without case differences', () => {
    expect(isNameUnique('AMINA', [{ name: 'Amina' }])).toBe(false);
  });
});

describe('progress', () => {
  it('lifetimePercent is a whole percent of 604', () => {
    expect(lifetimePercent(151)).toBe(25);
    expect(lifetimePercent(604)).toBe(100);
  });

  it('khatmaPercent guards against a zero total', () => {
    expect(khatmaPercent(10, 0)).toBe(0);
    expect(khatmaPercent(302, 604)).toBe(50);
  });
});

describe('feedback validation', () => {
  it('accepts normalized messages from 10 through 500 characters', () => {
    expect(isValidFeedbackMessage('  1234567890  ')).toBe(true);
    expect(isValidFeedbackMessage('a'.repeat(FEEDBACK_MAX_CHARACTERS))).toBe(true);
    expect(normalizeFeedbackMessage('  useful feedback  ')).toBe('useful feedback');
  });

  it('rejects messages outside the character limits after trimming', () => {
    expect(isValidFeedbackMessage('a'.repeat(FEEDBACK_MIN_CHARACTERS - 1))).toBe(false);
    expect(isValidFeedbackMessage('a'.repeat(FEEDBACK_MAX_CHARACTERS + 1))).toBe(false);
  });
});
