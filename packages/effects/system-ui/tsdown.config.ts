import { defineConfig } from 'tsdown';
import ElementPlus from 'unplugin-element-plus/rolldown';
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
  /**
   * 视图组件里用具名 import 引用 element-plus（如
   * `import { ElCard } from 'element-plus'`），要靠 unplugin-element-plus 转写成
   * 带样式的按需引入才能拿到对应组件的 CSS。这一步必须在本包自己构建时做完、
   * 把转写结果连同样式一起打进 dist——消费方以真实 npm 依赖形式安装本包时，
   * 它们的 Vite 依赖预构建（esbuild）会把 node_modules 下的本包当成整包一次性
   * 处理掉，那条路径不会再触发消费方自己配的 unplugin-element-plus，只有此刻
   * 已经转写好、直接躺在源码里的样式 import 才能存活下来。
   */
  plugins: [Vue({ isProduction: true }), ElementPlus({ format: 'esm' })],
  unbundle: true,
});
