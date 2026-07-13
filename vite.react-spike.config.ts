import { resolve } from 'node:path';
import { defineConfig, type UserConfig } from 'vite';
import productionConfig, { entryFiles } from './vite.config';

const baseConfig = productionConfig as UserConfig;

/**
 * Explicit, non-deployable build used to measure the two React preview entries.
 * The normal Vite config remains restricted to the legacy production entries.
 */
export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    outDir: 'dist-react-spike',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      ...baseConfig.build?.rollupOptions,
      input: {
        member: resolve(import.meta.dirname, entryFiles.reactPreview.member),
        admin: resolve(import.meta.dirname, entryFiles.reactPreview.admin),
      },
    },
  },
});
