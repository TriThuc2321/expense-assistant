import path from 'node:path';
import { defineConfig } from 'vitest/config';

const alias = {
  '@': path.resolve(__dirname, 'src'),
  // The real package throws outside the react-server condition.
  'server-only': path.resolve(__dirname, 'src/test/empty.ts'),
};

export default defineConfig({
  resolve: { alias },
  test: {
    setupFiles: ['./src/test/setup-env.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.db.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          environment: 'node',
          include: ['src/**/*.db.test.ts'],
          globalSetup: ['./src/test/db-global-setup.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
});
