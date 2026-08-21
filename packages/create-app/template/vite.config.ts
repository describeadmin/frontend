import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import ElementPlus from 'unplugin-element-plus/vite';
import { defineConfig } from 'vite';

/**
 * 后端地址。写成环境变量而不是常量：8080 在开发机上极易与其他项目撞车，
 * 撞了之后改一处配置就能绕开，不必改代码。
 */
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8090';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('package.json', import.meta.url)), 'utf8'),
);

export default defineConfig({
  define: {
    /**
     * `@describeadmin/ui` 的关于页读取这个全局变量展示依赖版本。
     * 数值直接来自本项目自己的 package.json，不依赖任何 monorepo 专用的解析工具。
     */
    __VBEN_ADMIN_METADATA__: JSON.stringify({
      buildTime: new Date().toISOString(),
      dependencies: pkg.dependencies ?? {},
      description: pkg.description ?? '',
      devDependencies: pkg.devDependencies ?? {},
      version: pkg.version,
    }),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  plugins: [
    vue(),
    tailwindcss(),
    ElementPlus({
      format: 'esm',
    }),
  ],
  server: {
    proxy: {
      /**
       * 开发期一律走 dev server 代理，不在后端放开 CORS。
       *
       * 跨域从根本上不产生，也就不存在「开发期图省事放开的 CORS 配置
       * 被原样带上生产」这类事故。后端的 describeadmin.security.allowed-origins
       * 默认为空，正是这个前提。
       *
       * 不做 rewrite：后端的接口本来就挂在 /api 下（/api/auth/login 等），
       * 剥掉前缀再拼回去只是徒增一处会写错的地方。
       */
      '/api': {
        changeOrigin: true,
        target: proxyTarget,
        ws: true,
      },
    },
  },
});
