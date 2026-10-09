import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** The core is pure game rules: no UI framework, no renderer, no platform APIs. */
const CORE_FORBIDDEN_IMPORTS = [
  'vue',
  'vue/*',
  '@vue/*',
  'pinia',
  'three',
  'three/*',
  'node:*',
  '@vermont/render',
  '@vermont/game',
];
const CORE_FORBIDDEN_GLOBALS = ['window', 'document', 'navigator', 'localStorage', 'process'];

/** The renderer draws what the core says; it never depends on the UI framework. */
const RENDER_FORBIDDEN_IMPORTS = ['vue', 'vue/*', '@vue/*', 'pinia', '@vermont/game'];

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['apps/game/**', 'packages/render/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.config.{ts,mts,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/core/src/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: CORE_FORBIDDEN_IMPORTS }],
      'no-restricted-globals': ['error', ...CORE_FORBIDDEN_GLOBALS],
    },
  },
  {
    files: ['packages/render/src/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: RENDER_FORBIDDEN_IMPORTS }],
    },
  },
  {
    rules: {
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Declaration files merge into global interfaces, which count as unused.
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
  prettier
);
