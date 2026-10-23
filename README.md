# describeadmin frontend

describeadmin 的前端：30 个 `@describeadmin/*` npm 包（锁步同版本，当前 1.0.0）与前端脚手架 `@describeadmin/create-app`。取材自 [Vben Admin](https://github.com/vbenjs/vue-vben-admin) 5.7.0 后独立演进，UI 库为 Element Plus，派生关系与维护责任见 [NOTICE.md](./NOTICE.md)。

**文档：<https://describeadmin.github.io/docs/>**，从 [从零跑起一个管理后台](https://describeadmin.github.io/docs/guide/getting-started) 开始。

## 开始使用

业务方依赖这些包，不复制本仓库。应用外壳由脚手架生成：

```bash
pnpm create @describeadmin/app my-web
cd my-web && pnpm install && pnpm dev
```

系统管理页面在 `@describeadmin/system-ui` 里，不在生成的工程里。各个包的用途见 [前端包目录](https://describeadmin.github.io/docs/reference/frontend-packages)，环境变量与偏好设置见 [前端配置](https://describeadmin.github.io/docs/reference/configuration/frontend)。

## 开发本仓库

```bash
pnpm install
pnpm dev            # apps/admin，http://localhost:5777，/api 代理到 http://localhost:8090（VITE_PROXY_TARGET 可覆盖）
pnpm lint           # 提交前
pnpm check          # 循环依赖、依赖声明、类型、拼写检查
pnpm test:unit
```

前端不带 mock，需要一个真实后端：用 `describeadmin-archetype` 生成一个工程并以 `local` profile 启动即可，步骤见 [apps/admin/e2e/README.md](./apps/admin/e2e/README.md)。

| 目录 | 内容 |
| --- | --- |
| `apps/admin/` | 框架自己的联调应用，不发布 |
| `packages/@core/` | 内核：布局、表单、弹窗、菜单等（`@describeadmin/core-*`） |
| `packages/effects/` | access / layouts / request / hooks / system-ui 等 |
| `packages/create-app/` | 前端脚手架，`template/` 与 `apps/admin` 的外壳手工同步 |
| `internal/` | 构建与 lint 配置，不发布 |

参与开发前读 docs 仓的 [`CLAUDE.md`](https://github.com/describeadmin/docs/blob/main/CLAUDE.md) 与 [前端开发约定](https://describeadmin.github.io/docs/dev/frontend)；发布照 [发布手册](https://describeadmin.github.io/docs/dev/release) 执行。

## 许可证

[MIT](./LICENSE)
