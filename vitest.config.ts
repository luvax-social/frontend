import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Unit project. Runs with no backend, no database, and no mail sink, which is what
// makes it safe as the continuous integration gate. The live suite has its own config.
export default defineConfig({
  // Source files use JSX without importing React, so the automatic runtime has to be
  // explicit here: the test transform does not inherit it from the app build config.
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['tests/live/**', 'node_modules/**', 'dist/**'],
  },
});
