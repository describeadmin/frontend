import type { Plugin } from 'vite';

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import ElementPlus from 'unplugin-element-plus/vite';
import { defineConfig, loadEnv } from 'vite';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('package.json', import.meta.url)), 'utf8'),
);

/**
 * 生产构建时把 `VITE_GLOB_*`（接口地址等）写进产物里的 `_app.config.js`，并在 index.html 里引用它。
 *
 * 运行时由 `@describeadmin/hooks` 的 `useAppConfig` 从 `window._VBEN_ADMIN_PRO_APP_CONF_` 读取：
 * 部署时改这一个文件就能换后端地址，不用重新打包——内网部署时后端地址往往要到现场才知道。
 * 文件名带内容哈希，改了配置浏览器不会拿到缓存里的旧文件。
 */
function appConfigPlugin(env: Record<string, string>): Plugin {
  const fileName = '_app.config.js';
  const globalName = '_VBEN_ADMIN_PRO_APP_CONF_';
  const config = Object.fromEntries(
    Object.entries(env).filter(([key]) => key.startsWith('VITE_GLOB_')),
  );
  const source =
    `window.${globalName}=${JSON.stringify(config)};` +
    `Object.freeze(window.${globalName});` +
    `Object.defineProperty(window,"${globalName}",{configurable:false,writable:false});`;
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 8);
  let base = '/';

  return {
    apply: 'build',
    configResolved(resolved) {
      base = resolved.base.endsWith('/') ? resolved.base : `${resolved.base}/`;
    },
    generateBundle() {
      this.emitFile({ fileName, source, type: 'asset' });
    },
    name: 'describeadmin:app-config',
    transformIndexHtml() {
      return [
        {
          attrs: { src: `${base}${fileName}?v=${pkg.version}-${hash}` },
          injectTo: 'head-prepend',
          tag: 'script',
        },
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  /**
   * `.env*` 文件与进程环境变量合并后的 `VITE_*`，进程环境变量优先。
   * 不要直接读 `process.env`：`.env` 文件里的值不会进 `process.env`，写在里面等于没写。
   */
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  /**
   * dev server 端口与后端地址。写成配置而不是常量：默认端口在开发机上极易与其他项目撞车，
   * 撞了之后改 `.env.development`（或临时设环境变量）一处就能绕开，不必改代码。
   * 端口缺省回落到 Vite 默认 5173。
   */
  const port = Number(env.VITE_PORT) || 5173;
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8090';

  return {
    // 部署子路径。与 src/router/index.ts 的 createWebHistory(VITE_BASE) 同源，
    // 两处不一致的话路由能进、静态资源却全部 404
    base: env.VITE_BASE || '/',
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
      appConfigPlugin(env),
      vue(),
      tailwindcss(),
      ElementPlus({
        format: 'esm',
        /**
         * `@describeadmin/system-ui` 等包里的组件用具名 import 引用
         * `element-plus`（如 `import { ElCard } from 'element-plus'`），未经本插件转写
         * 就拿不到对应组件的样式。这些包以真实 npm 依赖形式安装时源码落在
         * node_modules 下，而本插件默认排除整个 node_modules——症状是组件能渲染、
         * 布局却是无样式的纯文本，且不报任何错误。这里把 `@describeadmin/*` 从默认
         * 排除范围里择出来，与 tailwind-config/theme.css 里 `@source '../../'`
         * 那条为同一类问题（业务方消费场景下 node_modules 里的框架包需要被工具链
         * 当作源码处理）。
         */
        exclude: [
          /^(?!.*[/\\]@describeadmin[/\\]).*[/\\]node_modules[/\\]/,
          /[/\\]\.git[/\\]/,
          /[/\\]\.nuxt[/\\]/,
        ],
      }),
    ],
    server: {
      port,
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
  };
});
