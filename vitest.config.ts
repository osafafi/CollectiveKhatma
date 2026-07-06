import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    // Domain tests are pure — no DOM needed.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
