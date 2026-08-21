# @describeadmin/create-app

`npm create @describeadmin/app <项目名>` 的实现包。生成一个不含框架源码、只依赖 `@describeadmin/*` 的业务前端应用外壳——是 `apps/admin` 收走 `@describeadmin/system-ui` 之后剩下的那层（router/access/layouts/adapter 装配），不是 apps/admin 的复制品。

## 维护责任（手工同步，暂无自动化）

- **`template/`** 是 `apps/admin` 应用外壳的裁剪副本。`apps/admin` 的 `src/{adapter,layouts,router,store,api/{core,index.ts,request.ts},locales,types}`、 `main.ts`、`bootstrap.ts`、`app.vue`、`preferences.ts`、`index.html`、`public/` 这些文件变了，这里要跟着手工同步。**`views/system`、`views/dashboard`、 `views/project`、`api/system`、`api/project.ts` 不应该出现在这里**——前两者属于 `@describeadmin/system-ui`，后者是业务示例，不属于框架外壳。
- **`template/vite.config.ts` / `tsconfig*.json` 是独立维护的**，不是从 `apps/admin` 直接复制：`apps/admin` 依赖 `@describeadmin/vite-config` / `@describeadmin/tsconfig`（`internal/*`，未发布，只服务于框架自身构建），生成给业务方的外壳不能依赖这两个包，因此改用不依赖它们的等价写法（`@tailwindcss/vite` + `@vitejs/plugin-vue` + `unplugin-element-plus` 直接接入 `vite` 的 `defineConfig`，`tsconfig.json` 把 `internal/tsconfig` 的 base/web/web-app 三层展平成一份）。`apps/admin` 的 vite 配置换了插件或选项时，这里要判断是否需要跟进。
- **`src/versions.ts`** 手工维护 `@describeadmin/*` 的当前版本号（改 fixed 分组的单一常量即可，见文件内注释）与外部依赖的 `catalog:` 版本号。发布链路打通前这里没有别的数据源；`frontend/pnpm-workspace.yaml` 的 `catalog:` 小节改了版本，这里也要跟着改，否则生成器会用旧版本号，或者（新增依赖时）直接报错缺条目。

## 已知的简化（相对 apps/admin 的完整构建）

`apps/admin` 依赖 `@describeadmin/vite-config` 拿到的 PWA、Nitro mock、importmap（CDN 外部化）、压缩、分析等能力，`template/` 里都没有——这些是框架自身开发体验的增强，不是业务方起步必需的东西。业务方需要时自行在生成出的 `vite.config.ts` 里加。

## 本地验证

```bash
node bin/create-app.mjs my-app --  # 在当前目录下生成 my-app/
```

生成后到目标目录 `pnpm install`（此时 `@describeadmin/*` 已是真实版本号，不再是 `workspace:*`，因此不能直接在本仓 workspace 内 `pnpm install` ——包还没发布到 registry 前，需要用 `pnpm pack` 出的本地 tarball 或 `file:` 依赖替换，见 `docs/PROGRESS.md`）。
