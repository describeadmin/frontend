import { defineConfig } from 'tsdown';
import Vue from 'unplugin-vue/rolldown';

export default defineConfig({
  clean: true,
  deps: {
    skipNodeModulesBundle: true,
  },
  dts: {
    vue: true,
  },
  entry: {
    index: 'src/index.ts',
    'es/tippy': 'src/components/tippy/index.ts',
    'es/loading': 'src/components/loading/index.ts',
  },
  format: ['esm'],
  outExtensions: () => ({
    dts: '.d.ts',
    js: '.mjs',
  }),
  platform: 'neutral',
  plugins: [Vue({ isProduction: true })],
  unbundle: true,
});
