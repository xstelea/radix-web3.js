import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    fileParallelism: false,
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single fork (sequential)
      },
    },
  },
});
