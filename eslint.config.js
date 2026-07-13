import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'dist-react-spike', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Node scripts use process/console rather than browser globals.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },

  // TypeScript handles undefined identifiers and unused-var analysis; let
  // underscore-prefixed args/vars through (used by the Stage 2 stub signatures).
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      ...reactHooks.configs.flat.recommended.plugins,
      ...reactRefresh.configs.vite.plugins,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // GUARDRAIL 1 — Firebase may only be imported inside src/data/**. Every other
  // layer must go through the typed data-access functions (ARCHITECTURE.md).
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/data/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['firebase', 'firebase/*'],
              message:
                'Import Firebase only inside src/data/. Other layers must use the data-access functions.',
            },
          ],
        },
      ],
    },
  },

  // GUARDRAIL 2 — the domain layer must stay pure: no Firebase, data, or UI.
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['firebase', 'firebase/*'],
              message: 'domain must stay pure — no Firebase.',
            },
            {
              group: ['@/data', '@/data/*', '**/data/*'],
              message: 'domain must stay pure — no data-access imports.',
            },
            {
              group: ['@/ui', '@/ui/*', '**/ui/*'],
              message: 'domain must stay pure — no UI imports.',
            },
          ],
        },
      ],
    },
  },

  prettier,
);
