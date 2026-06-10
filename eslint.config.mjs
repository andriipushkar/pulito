import nextConfig from 'eslint-config-next';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const eslintConfig = [
  { ignores: ['generated/**'] },
  ...nextConfig,
  prettierConfig,
  {
    // Scope to the same glob eslint-config-next registers its plugins for —
    // referencing react-hooks rules outside it (e.g. *.cjs) crashes ESLint.
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // React 19 compiler diagnostics surface as errors by default but describe
      // optimization hints rather than broken code. Keep them visible as
      // warnings so CI doesn't fail on pre-existing patterns in a large codebase.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/error-boundaries': 'warn',
    },
  },
  // Test files (vitest unit + Playwright e2e + integration) intentionally use
  // raw <img> to mock next/image (see src/test/setup.ts), `any` in vi.fn mocks,
  // and probe variables like `const hasX = await locator.isVisible()` for
  // debugging. Relax strictness there.
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      'e2e/**/*.ts',
      'e2e/**/*.tsx',
      'documents/testing/**/*.ts',
    ],
    rules: {
      '@next/next/no-img-element': 'off',
      'jsx-a11y/alt-text': 'off',
      '@next/next/no-html-link-for-pages': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // k6 load tests require `export default function () { ... }` as the scenario
  // entry point; the anonymous default is part of the k6 API contract.
  {
    files: ['load-tests/**/*.js'],
    rules: {
      'import/no-anonymous-default-export': 'off',
    },
  },
];

export default eslintConfig;
