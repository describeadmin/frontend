import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  entry: ['src/index.ts'],
  format: ['esm'],
  outExtensions: () => ({
    dts: '.d.ts',
    js: '.mjs',
  }),
  platform: 'node',
});
