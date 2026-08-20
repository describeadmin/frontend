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
    echarts: 'src/echarts/index.ts',
    tiptap: 'src/tiptap/index.ts',
    'vxe-table': 'src/vxe-table/index.ts',
    motion: 'src/motion/index.ts',
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
