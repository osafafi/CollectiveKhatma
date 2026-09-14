import { describe, expect, it } from 'vitest';
import { pickDuaReciter, pickRolloverDuaReciter } from '@/domain/rotation';
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

describe('rollover reciter rotation', () => {
  const khatma = (reciter: string, number: number, seriesId = 'series') =>
    ({
      ...prior(reciter, number * 100),
      seriesId,
      seriesNumber: number,
    }) as Khatma;

  it('does not repeat the latest reciter even when their lifetime count is lowest', () => {
    const history = [khatma('a', 1), khatma('a', 2), khatma('a', 3), khatma('b', 4)];
    expect(pickDuaReciter(['a', 'b'], history)).toBe('b');
    expect(pickRolloverDuaReciter(['a', 'b'], history, 'series')).toBe('a');
  });

  it('uses series number and respects manual changes across consecutive rollovers', () => {
    const history = [khatma('b', 2), khatma('a', 1)];
    expect(pickRolloverDuaReciter(['a', 'b'], history, 'series')).toBe('a');
    history.push(khatma('a', 3));
    expect(pickRolloverDuaReciter(['a', 'b'], history, 'series')).toBe('b');
  });

  it('allows a single candidate and ignores other series for the no-repeat rule', () => {
    expect(pickRolloverDuaReciter(['a'], [khatma('a', 1)], 'series')).toBe('a');
    expect(
      pickRolloverDuaReciter(
        ['a', 'b'],
        [khatma('a', 1), khatma('b', 9, 'other')],
        'series',
      ),
    ).toBe('b');
  });
});
