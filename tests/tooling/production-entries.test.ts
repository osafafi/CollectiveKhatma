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
});
