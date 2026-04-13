import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'node_modules',
    '.pytest_tmp',
    'welcomeDispatchFunction.js',
    'scripts',
    'contextWindowStressTest.js',
    'src/App.jsx.*',
    'src/**/*.bak',
    'src/**/*.broken',
    'src/**/*.fixed*',
    'src/**/*.full',
    'src/**/*.test*',
    'telegram-bridge/**',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    ignores: [
      '**/*.config.js',
      '**/dist/**',
      '**/node_modules/**',
      '.pytest_tmp/**',
      'welcomeDispatchFunction.js',
      'scripts/**',
      'src/App.jsx.*',
      'src/**/*.bak',
      'src/**/*.broken',
      'src/**/*.fixed*',
      'src/**/*.full',
      'src/**/*.test*',
      'telegram-bridge/**',
    ],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, process: 'readonly' },
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
  {
    files: [
      'src/utils/uiAudit*.js',
      'src/utils/imageOptimizationChecker.js',
      'src/utils/performanceBenchmark.js',
      'src/utils/securityUtils.js',
      'src/services/performanceTestRunner.js',
      'src/services/firebaseHeartbeat.js',
      'src/services/telegramMonitor.js',
      'src/services/emailService.js',
      'src/services/telemetry.js',
      'src/services/leakagePreventionModule.js',
      'src/services/socialEngineeringDetectionModule.js',
    ],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: [
      'src/features/**/*Context.jsx',
      'src/features/shell/appShellChrome.jsx',
      'src/features/terminal/terminalHelperComponents.jsx',
      'src/features/terminal/TiltLockout.jsx',
      'src/features/terminal/VerdictRadar.jsx',
      'src/features/terminal/TradeTabCircuitBreaker.jsx',
      'src/utils/businessLogicUtils.jsx',
      'src/pages/CleanOnboarding.jsx',
      'src/pages/OnboardingSteps.jsx',
      'src/features/consensus/RegimeBadge.jsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
