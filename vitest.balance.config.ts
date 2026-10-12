import { defineConfig } from 'vitest/config';

/** Not a test run: `pnpm balance` lets the AIs fight the scenarios and prints who wins. */
export default defineConfig({
  test: {
    include: ['packages/ai/balance/**/*.balance.ts'],
    environment: 'node',
    silent: false,
  },
});
