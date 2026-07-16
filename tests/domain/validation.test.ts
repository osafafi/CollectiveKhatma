import { describe, expect, it } from 'vitest';
import { isNameUnique, normalizeName } from '@/domain/validation';
import { khatmaPercent, lifetimePercent } from '@/domain/progress';

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
