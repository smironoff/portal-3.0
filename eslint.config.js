import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'
import i18next from 'eslint-plugin-i18next'

export default defineConfig([
  globalIgnores(['dist', '.claude', 'src/router/routeTree.gen.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['src/features/auth/**/*.{ts,tsx}'],
    plugins: { i18next },
    rules: {
      // Flag hardcoded user-facing strings in JSX. Scoped to auth (the migrated
      // vertical); each later i18n slice widens this glob to its feature.
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },
])
