import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

/**
 * The admin app is a SEPARATE static entry with an unguessable filename. This
 * obscurity is the only gate protecting the admin panel — there is no auth
 * (see ARCHITECTURE.md#security). Replace this slug with your own before
 * deploying, and never link to it from the member app.
 */
const ADMIN_ENTRY = 'admin-nano.html';

export default defineConfig({
  // Base path for GitHub Pages *project* sites (e.g. '/Ranqur/'). Set per
  // environment via the BASE_PATH env var; defaults to '/' for local dev and
  // custom-domain / user-page hosting.
  base: process.env.BASE_PATH ?? '/',

  plugins: [tailwindcss()],

  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },

  build: {
    // Multi-page app: one bundle per HTML entry, sharing everything under src/.
    rollupOptions: {
      input: {
        member: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, ADMIN_ENTRY),
      },
    },
  },
});
