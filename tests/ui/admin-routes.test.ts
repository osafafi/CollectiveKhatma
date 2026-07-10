import { describe, expect, it } from 'vitest';
import { adminHash, DEFAULT_ADMIN_ROUTE, parseAdminRoute } from '@/ui/admin/routes';

describe('parseAdminRoute', () => {
  it('maps empty / root / home hashes to the home tab', () => {
    expect(parseAdminRoute('')).toEqual({ name: 'home' });
    expect(parseAdminRoute('#')).toEqual({ name: 'home' });
    expect(parseAdminRoute('#/')).toEqual({ name: 'home' });
    expect(parseAdminRoute('#/home')).toEqual({ name: 'home' });
  });

  it('distinguishes the khatmas list from a per-khatma page', () => {
    expect(parseAdminRoute('#/khatmas')).toEqual({ name: 'khatmas' });
    expect(parseAdminRoute('#/khatmas/abc')).toEqual({ name: 'khatma', id: 'abc' });
  });

  it('parses roster and settings tabs', () => {
    expect(parseAdminRoute('#/roster')).toEqual({ name: 'roster' });
    expect(parseAdminRoute('#/settings')).toEqual({ name: 'settings' });
  });

  it('is total: unknown routes fall back to the default', () => {
    expect(parseAdminRoute('#/nope')).toEqual(DEFAULT_ADMIN_ROUTE);
    expect(parseAdminRoute('#/khatma')).toEqual(DEFAULT_ADMIN_ROUTE); // member-style path
  });

  it('tolerates trailing slashes', () => {
    expect(parseAdminRoute('#/roster/')).toEqual({ name: 'roster' });
    expect(parseAdminRoute('#/khatmas/abc/')).toEqual({ name: 'khatma', id: 'abc' });
  });

  it('hash builders round-trip through the parser', () => {
    expect(parseAdminRoute(adminHash.home())).toEqual({ name: 'home' });
    expect(parseAdminRoute(adminHash.roster())).toEqual({ name: 'roster' });
    expect(parseAdminRoute(adminHash.khatmas())).toEqual({ name: 'khatmas' });
    expect(parseAdminRoute(adminHash.khatma('xyz'))).toEqual({ name: 'khatma', id: 'xyz' });
    expect(parseAdminRoute(adminHash.settings())).toEqual({ name: 'settings' });
  });
});
