import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

export default defineConfig(
  {
    ignores: ['**/dist/**', 'node_modules', 'eslint.config.mjs'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2024
    }
  },
  {
    files: ['**/*.js'],
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/indent': ['error', 4],
      '@stylistic/member-delimiter-style': ['error', {
        multiline: {
          delimiter: 'none',
          requireLast: false
        },
        singleline: {
          delimiter: 'comma',
          requireLast: false
        }
      }],
      '@stylistic/linebreak-style': ['error', 'windows'],
      'no-var': ['error'],
      'no-control-regex': 'off',
      'no-unused-vars': ['error', {
        vars: 'all',
        args: 'after-used',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: false,
        argsIgnorePattern: '^_|^reject$'
      }],
    }
  },
  {
    files: ['app/assets/js/scripts/*.js'],
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off'
    }
  }
);