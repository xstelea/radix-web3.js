import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {},
    // Run tests sequentially to avoid database conflicts and race conditions
    // pool: 'forks',
    // fileParallelism: false,
  },
});
