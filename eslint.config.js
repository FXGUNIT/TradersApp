import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'node_modules',
    'welcomeDispatchFunction.js',
    'scripts',
    'contextWindowStressTest.js',
    'src/App.jsx.*',
    'src/**/*.bak',
    'src/**/*.broken',
    'src/**/*.fixed*',
    'src/**/*.full',
    'src/**/*.test*',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    ignores: [
      '**/*.config.js',
      '**/dist/**',
      '**/node_modules/**',
      'welcomeDispatchFunction.js',
      'scripts/**',
      'src/App.jsx.*',
      'src/**/*.bak',
      'src/**/*.broken',
      'src/**/*.fixed*',
      'src/**/*.full',
      'src/**/*.test*',
    ],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
])
