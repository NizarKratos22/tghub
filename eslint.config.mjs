// @ts-check
// TG Hub code rules. `npm run lint` runs these with --max-warnings 0, so every rule here
// blocks CI. The reasons behind them are in docs/CODE_RULES.md.
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/node_modules/', '**/.next/', '**/dist/', '**/next-env.d.ts', 'apps/api/var/', 'coverage/']),

  js.configs.recommended,
  tseslint.configs.strict,

  {
    name: 'tgh/typescript',
    files: ['**/*.{ts,tsx,mts}'],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['apps/web/next.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      // Promises: an un-awaited promise in Express or a click handler fails silently.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      // Every case of a union is handled on purpose — adding a status or a role must fail here first.
      '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // noUncheckedIndexedAccess makes `!` the explicit, reviewed way to say "this index exists".
      '@typescript-eslint/no-non-null-assertion': 'off',
      // `apiFetch<void>` and `Promise<T | void>` mean "no body" on purpose.
      '@typescript-eslint/no-invalid-void-type': 'off',
      // Records are used as maps on purpose (query strings, cookies, counters).
      '@typescript-eslint/no-dynamic-delete': 'off',
      // TypeScript already reports undeclared names, with the right globals per app.
      'no-undef': 'off',
      eqeqeq: ['error', 'smart'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-param-reassign': ['error', { props: false }],
      'no-implicit-coercion': ['error', { allow: ['!!'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'properties'],
      'no-restricted-syntax': [
        'error',
        { selector: 'TSEnumDeclaration', message: 'Use a const array + union type (see packages/shared) instead of an enum.' },
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Render text, not HTML: everything players write is shown as text.' },
      ],
    },
  },

  {
    name: 'tgh/shared',
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@tgh/api', '@tgh/web', '**/apps/**'], message: 'packages/shared is imported by both apps and must not depend on either.' }] },
      ],
    },
  },

  {
    name: 'tgh/api',
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['@tgh/web', '**/apps/web/**', 'react', 'next', 'next/*'], message: 'The API must not depend on the web app.' }],
          paths: [{ name: 'dotenv', message: 'Read settings through src/config/env.ts — it validates them once at boot.' }],
        },
      ],
    },
  },
  {
    // One-off CLI scripts and the seed talk to whoever runs them.
    files: ['apps/api/src/scripts/**/*.ts', 'apps/api/src/seed/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // node:test's test() returns a promise the runner already tracks; test servers take async handlers.
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-floating-promises': 'off', '@typescript-eslint/no-misused-promises': 'off' },
  },

  {
    name: 'tgh/web',
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, '@next/next': nextPlugin },
    settings: { next: { rootDir: 'apps/web/' } },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.flat.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',
      // Covers come from IGDB/R2 at fixed sizes and are already optimised; next/image would proxy them twice.
      '@next/next/no-img-element': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@tgh/api', '**/apps/api/**'], message: 'The web app talks to the API over HTTP only (src/lib/api).' },
            { group: ['../../../*'], message: 'Use the @/ alias instead of deep relative imports.' },
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/public/sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },
);
