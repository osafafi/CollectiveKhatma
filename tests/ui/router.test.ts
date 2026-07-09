import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE, hash, parseRoute } from '@/ui/shared/router';

describe('parseRoute', () => {
  it('maps empty / root / khatmas hashes to the khatmas tab', () => {
    expect(parseRoute('')).toEqual({ name: 'khatmas' });
    expect(parseRoute('#')).toEqual({ name: 'khatmas' });
    expect(parseRoute('#/')).toEqual({ name: 'khatmas' });
    expect(parseRoute('#/khatmas')).toEqual({ name: 'khatmas' });
  });

  it('parses the quran tab with and without a page', () => {
    expect(parseRoute('#/quran')).toEqual({ name: 'quran' });
    expect(parseRoute('#/quran/50')).toEqual({ name: 'quran', page: 50 });
    // Non-integer page falls back to the tab root, not a broken page.
    expect(parseRoute('#/quran/abc')).toEqual({ name: 'quran' });
  });

  it('distinguishes a khatma landing from its reader route', () => {
    expect(parseRoute('#/khatma/abc')).toEqual({ name: 'khatma', id: 'abc' });
    expect(parseRoute('#/khatma/abc/read')).toEqual({ name: 'khatmaRead', id: 'abc' });
    // A khatma route with no id is meaningless -> default.
    expect(parseRoute('#/khatma')).toEqual(DEFAULT_ROUTE);
  });

  it('parses personal and settings tabs', () => {
    expect(parseRoute('#/personal')).toEqual({ name: 'personal' });
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' });
  });

  it('is total: unknown routes fall back to the default', () => {
    expect(parseRoute('#/nope')).toEqual(DEFAULT_ROUTE);
    expect(parseRoute('#/khatma/abc/nonsense')).toEqual({ name: 'khatma', id: 'abc' });
  });

  it('tolerates trailing slashes', () => {
    expect(parseRoute('#/personal/')).toEqual({ name: 'personal' });
    expect(parseRoute('#/khatma/abc/read/')).toEqual({ name: 'khatmaRead', id: 'abc' });
  });

  it('round-trips through the hash builders', () => {
    expect(parseRoute(hash.khatmas())).toEqual({ name: 'khatmas' });
    expect(parseRoute(hash.khatma('x1'))).toEqual({ name: 'khatma', id: 'x1' });
    expect(parseRoute(hash.khatmaRead('x1'))).toEqual({ name: 'khatmaRead', id: 'x1' });
    expect(parseRoute(hash.quran(3))).toEqual({ name: 'quran', page: 3 });
    expect(parseRoute(hash.quran())).toEqual({ name: 'quran' });
    expect(parseRoute(hash.personal())).toEqual({ name: 'personal' });
    expect(parseRoute(hash.settings())).toEqual({ name: 'settings' });
  });
});
