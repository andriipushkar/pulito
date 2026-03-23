import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
    },
  },
  test: {
    include: ['test/integration/**/*.test.ts'],
    setupFiles: ['test/integration/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: 'forks', // isolate tests
    fileParallelism: false, // sequential to avoid DB conflicts
  },
});
