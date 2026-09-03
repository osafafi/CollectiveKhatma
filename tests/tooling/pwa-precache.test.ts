import { describe, expect, it } from 'vitest';
import {
  adminOnlyOutputFiles,
  withoutAdminFiles,
  type ViteManifest,
} from '../../scripts/pwa-precache';

const ENTRIES = { member: 'index.html', admin: 'admin-nano.html' };

/**
 * Mirrors the real build graph: both entries share a `bootstrap` chunk, the
 * member reaches a lazy settings route, and the admin owns one exclusive chunk
 * plus a lazy route of its own.
 */
const manifest: ViteManifest = {
  'index.html': {
    file: 'assets/member.js',
    imports: ['_bootstrap.js'],
    dynamicImports: ['src/app/member/SettingsPage.tsx'],
  },
  'admin-nano.html': {
    file: 'assets/admin.js',
    imports: ['_bootstrap.js'],
    dynamicImports: ['src/app/admin/Planner.tsx'],
  },
  '_bootstrap.js': {
    file: 'assets/bootstrap.js',
    imports: ['_vendor.js'],
    css: ['assets/bootstrap.css'],
  },
  '_vendor.js': { file: 'assets/vendor.js' },
  'src/app/member/SettingsPage.tsx': { file: 'assets/SettingsPage.js' },
  'src/app/admin/Planner.tsx': { file: 'assets/Planner.js' },
};

describe('service worker precache selection', () => {
  it('treats only chunks the member cannot reach as admin-only', () => {
    expect(adminOnlyOutputFiles(manifest, ENTRIES)).toEqual([
      'assets/Planner.js',
      'assets/admin.js',
    ]);
  });

  it('keeps chunks, styles, and vendors that both entries share', () => {
    const adminOnly = adminOnlyOutputFiles(manifest, ENTRIES);

    for (const shared of [
      'assets/bootstrap.js',
      'assets/bootstrap.css',
      'assets/vendor.js',
      'assets/member.js',
      'assets/SettingsPage.js',
    ]) {
      expect(adminOnly).not.toContain(shared);
    }
  });

  it('counts a lazily imported admin route as admin-only', () => {
    // A dynamic import is still admin code — precaching it would ship the
    // panel to every member device.
    expect(adminOnlyOutputFiles(manifest, ENTRIES)).toContain('assets/Planner.js');
  });

  it('strips the admin document and its exclusive chunks from a precache list', () => {
    const precache = [
      { url: 'index.html', revision: 'abc' },
      { url: 'admin-nano.html', revision: 'def' },
      { url: 'assets/member.js', revision: null },
      { url: 'assets/admin.js', revision: null },
      { url: 'assets/Planner.js', revision: null },
      { url: 'assets/bootstrap.js', revision: null },
    ];

    expect(withoutAdminFiles(precache, manifest, ENTRIES)).toEqual([
      { url: 'index.html', revision: 'abc' },
      { url: 'assets/member.js', revision: null },
      { url: 'assets/bootstrap.js', revision: null },
    ]);
  });

  it('never leaks the admin entry filename into the precache list', () => {
    // The unguessable admin filename is the only gate on the panel
    // (ARCHITECTURE.md#security) and `sw.js` is world-readable.
    const precache = [{ url: 'admin-nano.html', revision: 'def' }];

    expect(withoutAdminFiles(precache, manifest, ENTRIES)).toEqual([]);
  });

  it('leaves a precache list untouched when nothing is admin-only', () => {
    const memberOnly = [{ url: 'index.html', revision: 'abc' }];

    expect(withoutAdminFiles(memberOnly, manifest, ENTRIES)).toEqual(memberOnly);
  });
});
