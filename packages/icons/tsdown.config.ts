import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';

import { defineConfig } from 'tsdown';
import Vue from 'unplugin-vue/rolldown';

const RAW_SUFFIX = /\?raw$/;

/**
 * 让 `import '....svg?raw'` 在构建期可解析。
 *
 * `src/svg/load.ts` 用 `import.meta.glob('./icons/**', { query: '?raw' })`
 * 把 16 个 svg 读成字符串，再在浏览器里用 DOMParser 注册成图标。
 * `import.meta.glob` 本身 rolldown 支持，**但 `?raw` 后缀是 Vite 专有的**——
 * 少了这个插件，rolldown 会拿着带 `?` 的路径去读文件，在 Windows 上报
 * UNLOADABLE_DEPENDENCY / os error 123（`?` 不是合法文件名字符）。
 *
 * 这类「monorepo 内能用、发布出去不能用」的 Vite 专有语法，是前端分层此前
 * 停留在纸面的根因之一，见 develop_plan.md 9.3。
 */
function rawSuffixLoader() {
  return {
    name: 'describeadmin:raw-suffix',
    async load(id: string) {
      if (!RAW_SUFFIX.test(id)) return null;
      const file = id.replace(RAW_SUFFIX, '');
      const abs = isAbsolute(file) ? file : resolve(process.cwd(), file);
      return `export default ${JSON.stringify(await readFile(abs, 'utf8'))};`;
    },
  };
}

export default defineConfig({
  clean: true,
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
  plugins: [Vue({ isProduction: true }), rawSuffixLoader()],
  unbundle: true,
});
