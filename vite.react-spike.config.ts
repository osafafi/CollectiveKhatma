import { resolve } from 'node:path';
import { defineConfig, type UserConfig } from 'vite';
import productionConfig, { entryFiles } from './vite.config';

const baseConfig = productionConfig as UserConfig;

/**
 * Explicit, non-deployable build retained for stable RM-040 measurements of the
 * two React preview entries. The production build publishes only its deployable
 * HTML inputs; this build writes the equivalent React surfaces to a separate
 * output directory with a manifest for the budget checker.
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
