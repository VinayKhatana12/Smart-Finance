import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    pool: 'forks',
    fileParallelism: false,
  },
});
