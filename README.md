# describeadmin frontend

describeadmin 的前端。由 [Vben Admin](https://github.com/vbenjs/vue-vben-admin) **5.7.0** 一次性取材后独立演进，UI 库为 Element Plus。派生关系与维护责任见 [NOTICE.md](./NOTICE.md)。

**从零开始用这套框架，请看 [快速开始](https://github.com/describeadmin/docs/blob/main/QUICKSTART.md)。** 本文是本仓库自身的开发说明。

## 分发形态

`packages/` 下的 27 个包发布到 npm，作用域 `@describeadmin/*`，当前版本 `0.1.0`。业务方**依赖这些包**，而不是把它们复制进自己的仓库。

`apps/admin` 是应用外壳，标了 `private`，不发布——它是业务方要拥有的部分。把外壳单独取出来的脚手架（`npm create @describeadmin/app`）尚未交付，在那之前业务方以本仓库的 `apps/admin` 为起点。

## 快速开始（开发本仓库）

```bash
pnpm install
pnpm dev            # http://localhost:5777
```

前端需要一个真实后端。**本项目不带 mock**——用 mock 开发前端，等于把前后端契约不一致的问题全部推迟到联调阶段才暴露。起后端的步骤见 [apps/admin/e2e/README.md](./apps/admin/e2e/README.md)。

默认代理到 `http://localhost:8090`，可用 `VITE_PROXY_TARGET` 覆盖。

## 仓库结构

```
apps/admin/          唯一应用（由官方 apps/web-ele 更名而来）
packages/@core/      内核：布局、表单、弹窗、无样式组件原语（UI 库无关）
packages/effects/    access / layouts / request / ui / plugins / hooks
packages/            constants / icons / locales / preferences / stores / styles / types / utils
packages/ele-ui/     绑定 Element Plus 的组件层（peerDeps: element-plus + vue）
internal/            构建与 lint 配置（private，不发布）
```

## 与后端的关系

| 约定 | 说明 |
| --- | --- |
| 响应体 | 后端统一返回 `Result`：`{ code, message, data, traceId }`，`code === 0` 为成功 |
| 认证 | 不透明令牌，`Authorization: Bearer <token>`。**没有 refresh 端点**，`enableRefreshToken` 保持 `false` |
| 菜单与路由 | `accessMode: 'backend'`，全部由后端 `sys_menu` 表下发 |
| 按钮权限 | 权限码随 `/api/auth/me` 的 `permissions` 下发，用 `v-access:code` 控制显隐 |

⚠️ `accessMode: 'backend'` 下，**前端的静态路由模块完全不参与路由生成**。 `defaultHomePath` 只能填菜单表里真实存在的路径，否则登录后直接落到 404（见 VERSION_BASELINE.md 发现 ⑪）。

## data-testid 是硬约束

所有交互元素必须带 `data-testid`，命名 `<模块>-<对象>-<动作>`（CLAUDE.md 4.4）。 **没有 `data-testid` 的交互元素视为未完成**——AI 的端到端自测靠它定位。

这条约束有实际后果：删除确认用受控 `ElDialog` 而不是 `ElMessageBox.confirm`，因为后者由命令式 API 弹出，按钮上挂不了 `data-testid`。

## 命令

```bash
pnpm dev                                  # 开发
pnpm -F @describeadmin/admin run build    # 构建
pnpm -F @describeadmin/admin run typecheck
pnpm -F @describeadmin/admin run test:e2e # 端到端冒烟（需后端已启动）
pnpm exec eslint packages apps internal
```
