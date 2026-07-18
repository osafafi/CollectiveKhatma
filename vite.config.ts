import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { publicKhatmaImages } from './scripts/khatma-image-catalog';

/**
 * The admin app is a SEPARATE static entry with an unguessable filename. This
 * obscurity is the only gate protecting the admin panel — there is no auth
 * (see ARCHITECTURE.md#security). Replace this slug with your own before
 * deploying, and never link to it from the member app.
 */
const ADMIN_ENTRY = 'admin-nano.html';

export const entryFiles = {
  production: {
    member: 'index.html',
    admin: ADMIN_ENTRY,
  },
} as const;

/**
 * Stable cache groups for the large shared runtime. Route modules are small and
 * remain synchronous; splitting the framework, UI, and Firebase vendors keeps
 * the MUI and Firebase vendors keeps every chunk below Vite's warning threshold
 * and lets browsers reuse those long-lived packages independently from app code.
 */
function vendorChunk(id: string): string | undefined {
  const moduleId = id.replaceAll('\\', '/');
  if (!moduleId.includes('/node_modules/')) return undefined;

  if (
    moduleId.includes('/node_modules/firebase/') ||
    moduleId.includes('/node_modules/@firebase/')
  ) {
    return 'vendor-firebase';
  }

  if (
    moduleId.includes('/node_modules/@mui/') ||
    moduleId.includes('/node_modules/@emotion/') ||
    moduleId.includes('/node_modules/stylis/') ||
    moduleId.includes('/node_modules/stylis-plugin-rtl/')
  ) {
    return 'vendor-mui';
  }

  return undefined;
}

export default defineConfig({
  // Base path for GitHub Pages *project* sites (e.g. '/Ranqur/'). Set per
  // environment via the BASE_PATH env var; defaults to '/' for local dev and
  // custom-domain / user-page hosting.
  base: process.env.BASE_PATH ?? '/',

  // React owns JSX transformation and development Fast Refresh.
  plugins: [react()],

  define: {
    __KHATMA_SERIES_IMAGES__: JSON.stringify(publicKhatmaImages(import.meta.dirname)),
  },

  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },

  build: {
    // The budget gate reads this manifest so its totals match both entries.
    manifest: true,
    // Member and hidden admin are the only deployable entries.
    rollupOptions: {
      input: {
        member: resolve(import.meta.dirname, entryFiles.production.member),
        admin: resolve(import.meta.dirname, entryFiles.production.admin),
      },
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
});
