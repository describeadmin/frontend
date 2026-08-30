import { defineConfig } from 'tsdown';
import Vue from 'unplugin-vue/rolldown';

export default defineConfig({
  clean: true,
  /**
   * tsdown 的 CSS 支持默认关闭 inject：Vue SFC 的 style 块虽然会被抽成单独的
   * css 文件，但编译产物里不会保留指向它的 import 语句（只留一行注释占位），
   * CSS 因此在消费方那边彻底丢失且不报任何错——组件正常渲染，样式却整体缺失。
   * 开启后编译产物会带上真正的样式 import。
   */
  css: {
    inject: true,
  },
  deps: {
    skipNodeModulesBundle: true,
  },
  dts: {
    vue: true,
  },
  entry: ['src/index.ts'],
  format: ['esm'],
  outExtensions: () => ({
    dts: '.d.ts',
    js: '.mjs',
  }),
  platform: 'neutral',
  plugins: [Vue({ isProduction: true })],
  unbundle: true,
});
