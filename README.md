# describeadmin frontend

describeadmin 的前端。由 [Vben Admin](https://github.com/vbenjs/vue-vben-admin) **5.7.0** 一次性取材后独立演进，UI 库为 Element Plus。派生关系与维护责任见 [NOTICE.md](./NOTICE.md)。

**从零开始用这套框架，请看 [快速开始](https://github.com/describeadmin/docs/blob/main/QUICKSTART.md)。** 本文是本仓库自身的开发说明。

## 分发形态

`packages/` 下的 `@describeadmin/*` 包发布到 npm，按 `.changeset/config.json` 的 fixed 分组**锁步同版本**（当前 `0.2.x`）。业务方**依赖这些包**，而不是把它们复制进自己的仓库。

`apps/admin` 是框架自己的联调 playground，标了 `private`、不发布。业务方**不以它为起点**——应用外壳由脚手架交付：

```bash
npm create @describeadmin/app my-app
```

生成的是收走系统管理四页面（`@describeadmin/system-ui`）之后的薄外壳，只保留每个应用都要自己拥有的 router / access / layouts / adapter 装配。实现包是 `packages/create-app`。

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

## 相关文档

编码规范与设计方案都在 **`describeadmin/docs`** 仓——做本仓开发时把它与 `docs` 仓并列检出：

- `docs/CLAUDE.md` —— 编码规范（`4.4` data-testid、`4.9` Tailwind/Element Plus 层叠层陷阱等）
- `docs/develop_plan.md` 第四章 —— 前端架构与 Vben 取材方式
- `docs/QUICKSTART.md` —— 业务方从零接入
- `docs/PROGRESS.md` —— 当前进度
