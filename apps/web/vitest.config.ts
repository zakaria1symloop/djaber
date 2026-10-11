import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.spec.{ts,tsx}'], environment: 'node' },
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
});
