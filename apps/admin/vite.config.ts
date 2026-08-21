import process from 'node:process';

import { defineConfig } from '@describeadmin/vite-config';

import ElementPlus from 'unplugin-element-plus/vite';

/**
 * 后端地址。写成环境变量而不是常量：8080 在开发机上极易与其他项目撞车，
 * 撞了之后改一处配置就能绕开，不必改代码。
 */
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8090';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      plugins: [
        ElementPlus({
          format: 'esm',
          /**
           * 默认排除整个 node_modules，会漏转写 `@describeadmin/system-ui` 等包里
           * `import { ElCard } from 'element-plus'` 这类具名 import——业务方以真实
           * npm 依赖形式安装这些包时（sample-frontend 用 pnpm pack 模拟过一次，
           * 已实测触发），组件能渲染但拿不到样式，且不报错。详见
           * create-app/template/vite.config.ts 同一处配置的注释。
           */
          exclude: [
            /^(?!.*[/\\]@describeadmin[/\\]).*[/\\]node_modules[/\\]/,
            /[/\\]\.git[/\\]/,
            /[/\\]\.nuxt[/\\]/,
          ],
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
    },
  };
});
