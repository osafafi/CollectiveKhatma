import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { UserConfig } from 'vite';
import viteConfig, { entryFiles } from '../../vite.config';

const root = resolve(import.meta.dirname, '../..');
const config = viteConfig as UserConfig;

describe('production entries', () => {
  it('keeps React transformation and Fast Refresh in the Vite plugin chain', () => {
    const configuredPlugins = (config.plugins ?? []) as unknown[];
    const plugins = configuredPlugins.flat(Number.POSITIVE_INFINITY);
    const pluginNames = plugins.flatMap((plugin) => {
      if (
        typeof plugin === 'object' &&
        plugin !== null &&
        'name' in plugin &&
        typeof plugin.name === 'string'
      ) {
        return [plugin.name];
      }
      return [];
    });

    expect(pluginNames).toEqual(
      expect.arrayContaining(['vite:react-babel', 'vite:react-refresh']),
    );
  });

  it('keeps the production build restricted to the two deployable entries', () => {
    const input = config.build?.rollupOptions?.input;

    expect(input).toEqual({
      member: resolve(root, entryFiles.production.member),
      admin: resolve(root, entryFiles.production.admin),
    });
  });

  it('emits a production manifest for bundle-budget measurement', () => {
    expect(config.build?.manifest).toBe(true);
    expect(config.build?.rollupOptions?.output).toMatchObject({
      manualChunks: expect.any(Function),
    });
  });

  it('wires both production pages to React', async () => {
    const [memberProduction, adminProduction] = await Promise.all([
      readFile(resolve(root, entryFiles.production.member), 'utf8'),
      readFile(resolve(root, entryFiles.production.admin), 'utf8'),
    ]);

    expect(memberProduction).toContain('src="/src/app/entries/member.tsx"');
    expect(memberProduction).not.toContain('src="/src/member.ts"');
    expect(adminProduction).toContain('src="/src/app/entries/admin.tsx"');
    expect(adminProduction).not.toContain('src="/src/admin.ts"');
  });

  it('ships member install metadata and complete home-screen icon sizes', async () => {
    const [memberProduction, manifestSource, icon192, icon512, appleTouchIcon] =
      await Promise.all([
        readFile(resolve(root, entryFiles.production.member), 'utf8'),
        readFile(resolve(root, 'public/manifest.webmanifest'), 'utf8'),
        readFile(resolve(root, 'public/app-icons/app-icon-192.png')),
        readFile(resolve(root, 'public/app-icons/app-icon-512.png')),
        readFile(resolve(root, 'public/app-icons/apple-touch-icon.png')),
      ]);
    const manifest = JSON.parse(manifestSource) as {
      display: string;
      start_url: string;
      icons: Array<{ sizes: string; purpose: string }>;
    };

    expect(memberProduction).toContain(
      'rel="manifest" href="%BASE_URL%manifest.webmanifest"',
    );
    expect(memberProduction).toContain('rel="apple-touch-icon"');
    expect(manifest).toMatchObject({
      display: 'standalone',
      start_url: './#/khatmas',
      icons: [
        { sizes: '192x192', purpose: 'any' },
        { sizes: '512x512', purpose: 'any maskable' },
      ],
    });
    for (const icon of [icon192, icon512, appleTouchIcon]) {
      expect(icon.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    }
    expect([icon192.readUInt32BE(16), icon192.readUInt32BE(20)]).toEqual([192, 192]);
    expect([icon512.readUInt32BE(16), icon512.readUInt32BE(20)]).toEqual([512, 512]);
    expect([appleTouchIcon.readUInt32BE(16), appleTouchIcon.readUInt32BE(20)]).toEqual([
      180, 180,
    ]);
  });
});
