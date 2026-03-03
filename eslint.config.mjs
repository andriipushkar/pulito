import nextConfig from 'eslint-config-next';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const eslintConfig = [
  { ignores: ['generated/**'] },
  ...nextConfig,
  prettierConfig,
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];

export default eslintConfig;
