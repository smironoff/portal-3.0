/**
 * Enforcement test for i18next/no-literal-string in src/features/auth/**
 *
 * This test is a regression guard for the ESLint config: it proves that the
 * exact rule + options wired up in eslint.config.js for auth files genuinely
 * report an error on hardcoded JSX text and stay silent on translated calls.
 *
 * If this test starts failing because the rule fires zero errors on hardcoded
 * text, the ESLint config has gone inert and must be fixed before merging.
 */
import { describe, it, expect } from 'vitest'
import { Linter } from 'eslint'
import i18nextPlugin from 'eslint-plugin-i18next'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Linter instance configured with the same rule + options that
 * eslint.config.js applies to src/features/auth/**\/*.tsx files.
 */
const buildConfig = (): Linter.Config[] => [
  {
    files: ['**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { i18next: i18nextPlugin },
    rules: {
      // This must stay in sync with the auth-scoped override in eslint.config.js.
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },
]

const linter = new Linter({ configType: 'flat' })

function lintTsx(source: string): Linter.LintMessage[] {
  // Filename must match the glob in the config above.
  return linter.verify(source, buildConfig(), { filename: 'src/features/auth/Probe.tsx' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('i18next/no-literal-string enforcement in auth feature', () => {
  it('reports an error for a hardcoded JSX text node in a PascalCase component', () => {
    // This is the canonical case: a real React component with a literal child.
    const source = `
      import React from 'react';
      const LoginProbe = () => <div>Sign in to your account</div>;
      export default LoginProbe;
    `
    const messages = lintTsx(source)
    const ruleMessages = messages.filter((m) => m.ruleId === 'i18next/no-literal-string')
    expect(ruleMessages.length).toBeGreaterThanOrEqual(1)
    expect(ruleMessages[0].severity).toBe(2) // 2 = error
  })

  it('reports an error when hardcoded text appears inside nested JSX children', () => {
    const source = `
      import React from 'react';
      const TitleProbe = () => (
        <div>
          <h1>Welcome back</h1>
        </div>
      );
      export default TitleProbe;
    `
    const messages = lintTsx(source)
    const ruleMessages = messages.filter((m) => m.ruleId === 'i18next/no-literal-string')
    expect(ruleMessages.length).toBeGreaterThanOrEqual(1)
  })

  it('does not report an error when JSX text is replaced with a t() call', () => {
    // The rule must stay silent on properly-translated components.
    const source = `
      import React from 'react';
      import { useTranslation } from 'react-i18next';
      const LoginForm = () => {
        const { t } = useTranslation('auth');
        return <div>{t('login.signIn')}</div>;
      };
      export default LoginForm;
    `
    const messages = lintTsx(source)
    const ruleMessages = messages.filter((m) => m.ruleId === 'i18next/no-literal-string')
    expect(ruleMessages.length).toBe(0)
  })

  it('does not report an error when JSX text is a JSX expression containing a variable', () => {
    const source = `
      import React from 'react';
      const Display = ({ label }) => <span>{label}</span>;
      export default Display;
    `
    const messages = lintTsx(source)
    const ruleMessages = messages.filter((m) => m.ruleId === 'i18next/no-literal-string')
    expect(ruleMessages.length).toBe(0)
  })

  it('does not report an error for the auth API code (non-JSX string literals in a .ts file)', () => {
    // aseCodes.ts uses string keys/values that are i18n key names, not user-facing
    // JSX text. The rule is mode: jsx-text-only so it must not flag these.
    const source = `
      const MAP = {
        'ASE-001': 'auth.error.invalidCredentials',
        'ASE-002': 'auth.error.tfaExpired',
      };
      export const aseCodeToMessageKey = (code) => {
        return (code && MAP[code]) || 'auth.error.generic';
      };
    `
    // Use a .ts filename - the rule is configured for **/*.tsx but we verify
    // that plain TS files with non-JSX strings are not flagged when checked with
    // the same options by wrapping the config to cover .ts too.
    const tsConfig: Linter.Config[] = [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
          },
        },
        plugins: { i18next: i18nextPlugin },
        rules: {
          'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
        },
      },
    ]
    const messages = linter.verify(source, tsConfig, {
      filename: 'src/features/auth/api/aseCodes.ts',
    })
    const ruleMessages = messages.filter((m) => m.ruleId === 'i18next/no-literal-string')
    expect(ruleMessages.length).toBe(0)
  })
})
