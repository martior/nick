/**
 * Vitest Config
 * @module vitest.config
 */

// External imports
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    setupFiles: ['./vitest.setup.js'],
    exclude: [
      'packages/generator-nick/**',
      '**/node_modules/**',
      'frontend/**',
    ],
  },
});
