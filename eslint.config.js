import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import tseslint from 'typescript-eslint';

export default [
  // .vite-cache is where vite.config.js relocates Vite's cacheDir. Without it here, `eslint .`
  // walked the 18 pre-bundled dependency files under .vite-cache/deps - react-dom at 820 kB,
  // react-router-dom at 398 kB, and the rest - and reported formatting violations on every line of
  // generated vendor code: 54,518 findings on top of the 1,278 real ones, and over five minutes to
  // run. That made the lint script unusable as a gate, which is why it was never wired into CI.
  { ignores: ['dist', 'node_modules', 'build', '.vite-cache', 'coverage', '.workspace/**'] },

  // Base JS rules
  {
    files: ['**/*.{js,jsx}'],
    ...js.configs.recommended,
  },

  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx,mts}'],
  })),

  // React & App rules
  {
    files: ['**/*.{js,jsx,ts,tsx,mts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      prettier: prettierPlugin,
    },
    rules: {
      // React Hooks
      ...reactHooks.configs.recommended.rules,

      // React Refresh
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Prettier integration
      'prettier/prettier': 'error',

      // General best practices
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },

  {
    files: ['**/*.{ts,tsx,mts}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // Prettier disables conflicting rules last
  prettierConfig,
];
