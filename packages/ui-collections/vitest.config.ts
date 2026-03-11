import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

const rootModules = resolve(__dirname, '../../node_modules');

export default defineConfig({
  resolve: {
    alias: {
      '@mantine/core': resolve(__dirname, 'tests/__mocks__/@mantine/core.tsx'),
      '@tabler/icons-react': resolve(__dirname, 'tests/__mocks__/@tabler/icons-react.tsx'),
      'react': resolve(rootModules, 'react'),
      'react-dom': resolve(rootModules, 'react-dom'),
      'react/jsx-runtime': resolve(rootModules, 'react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(rootModules, 'react/jsx-dev-runtime'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
