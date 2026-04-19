import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../../src'),
    },
  },
  test: {
    include: ['documents/testing/integration/**/*.test.ts'],
    setupFiles: ['documents/testing/integration/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: 'forks',
    fileParallelism: false,
  },
});
