import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { publicKhatmaImages } from './scripts/khatma-image-catalog';

export default defineConfig({
  define: {
    __KHATMA_SERIES_IMAGES__: JSON.stringify(publicKhatmaImages(import.meta.dirname)),
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          setupFiles: ['./tests/setup/react.ts'],
          include: ['tests/**/*.test.tsx'],
        },
      },
    ],
  },
});
