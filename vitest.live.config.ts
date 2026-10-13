import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Live project. Talks to a real backend, seeds real accounts, and polls a real mail sink,
// so it is never run in continuous integration.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/live/**/*.live.test.ts'],
    // Serial execution keeps per-endpoint rate-limit buckets and Mailpit state predictable.
    // Parallel files would race each other into a 429 and fail for the wrong reason.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 40000,
  },
});
