import { describe, expect, it } from 'vitest';
import { pickDuaReciter } from '@/domain/rotation';
import type { Khatma } from '@/domain/types';

/** Minimal prior-khatma stub carrying just what the rotation reads. */
function prior(
  duaReciterId: string,
  when: number,
  completed = true,
): Pick<Khatma, 'duaReciterId' | 'completedAt' | 'createdAt'> {
  return completed
    ? { duaReciterId, completedAt: when, createdAt: when - 1 }
    : { duaReciterId, createdAt: when };
}

describe('pickDuaReciter', () => {
  it('rejects an empty candidate list', () => {
    expect(() => pickDuaReciter([], [])).toThrow(
      'pickDuaReciter: at least one candidate is required',
    );
  });

  it('returns the first candidate when there is no history', () => {
    expect(pickDuaReciter(['a', 'b', 'c'], [])).toBe('a');
  });

  it('picks the candidate who has recited least often', () => {
    const history = [prior('a', 100), prior('a', 200), prior('b', 300)];
    expect(pickDuaReciter(['a', 'b', 'c'], history)).toBe('c'); // c has never recited
  });

  it('breaks ties by who recited longest ago', () => {
    // a and b have each recited once; a longer ago (t=50) than b (t=300).
    const history = [prior('a', 50), prior('b', 300)];
    expect(pickDuaReciter(['a', 'b'], history)).toBe('a');
  });

  it('breaks a full tie by candidate order', () => {
    const history = [prior('a', 100), prior('b', 100)];
    expect(pickDuaReciter(['a', 'b'], history)).toBe('a');
  });

  it('ignores reciters who are not among the candidates', () => {
    // z recited a lot but is not a candidate; among a/b, both fresh → first (a).
    const history = [prior('z', 100), prior('z', 200)];
    expect(pickDuaReciter(['a', 'b'], history)).toBe('a');
  });

  it('counts concurrent (not-yet-completed) khatmas so the designation rotates', () => {
    // a is the reciter of an active khatma (createdAt only). b/c are fresh → b (order).
    const history = [prior('a', 500, false)];
    expect(pickDuaReciter(['a', 'b', 'c'], history)).toBe('b');
  });
});
