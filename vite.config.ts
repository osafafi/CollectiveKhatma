import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';
import { publicKhatmaImages } from './scripts/khatma-image-catalog';
import { readViteManifest, withoutAdminFiles } from './scripts/pwa-precache';

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

const base = process.env.BASE_PATH ?? '/';

/** Escape a literal path for embedding in a RegExp source. */
function escapeRegExp(value: string): string {
  return value.replaceAll(/[$()*+.?[\\\]^{|}]/g, (character) => `\\${character}`);
}

export default defineConfig({
  // Base path for GitHub Pages *project* sites (e.g. '/Ranqur/'). Set per
  // environment via the BASE_PATH env var; defaults to '/' for local dev and
  // custom-domain / user-page hosting.
  base,

  // React owns JSX transformation and development Fast Refresh.
  plugins: [
    react(),
    // Offline shell for the member app. Registration is manual (see
    // `src/app/member/install/serviceWorkerRegistration.ts`) so `workbox-window`
    // stays out of the member bundle and its size budget.
    VitePWA({
      injectRegister: null,
      // `public/manifest.webmanifest` is hand-written and already linked from
      // index.html; the plugin must not emit a competing one.
      manifest: false,
      filename: 'sw.js',
      // No `skipWaiting`: a new worker waits rather than reloading a member
      // mid-page. It takes over the next time the app is opened fresh.
      registerType: 'prompt',
      workbox: {
        // The mushaf under `quran/` is deliberately absent — caching it is its
        // own layer, and precaching 604 files would stall the first install.
        globPatterns: [
          'index.html',
          'manifest.webmanifest',
          'assets/**/*.{js,css,woff2}',
          'app-icons/**/*.png',
        ],
        // Hash routing means the member app only ever navigates to the base
        // URL. An allowlist keeps the fallback off every other path — notably
        // the admin entry, which must keep reaching the network and whose name
        // must never be written into `sw.js`.
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [new RegExp(`^${escapeRegExp(base)}$`)],
        cleanupOutdatedCaches: true,
        manifestTransforms: [
          (entries) => ({
            manifest: withoutAdminFiles(
              entries,
              readViteManifest(resolve(import.meta.dirname, 'dist')),
              entryFiles.production,
            ),
          }),
        ],
      },
    }),
  ],

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
