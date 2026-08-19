# NOTICE

本仓库的代码基于 [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)
的 **v5.7.0** 快照派生，原项目以 MIT 许可证发布，版权归其作者所有，
许可证全文见 `LICENSE`。

## 派生方式与后续关系

本仓库采取的是 develop_plan.md 4.1 所确定的「一次性取材后独立演进」：

- 起点为上游 v5.7.0，此后**与上游断开，不做 merge**
- `packages/` 已改造为 `@describeadmin/*` scope 下的可发布 npm 包
- 上游后续的更新与 bugfix **不会**自动流入本仓库

**这是一项需要明确承担的成本**：`packages/` 下全部代码的维护责任
（含安全修复）自快照之日起由框架团队承担。这一条已落到第七章的框架 Owner 职责中。

## 保留了什么、改了什么

| 项 | 处置 |
|---|---|
| npm scope `@vben/*`、`@vben-core/*` | 改为 `@describeadmin/*`、`@describeadmin/core-*` |
| 组件名 `VbenButton` 等、CSS 类名 `vben-*` | **保留不改** |
| `LICENSE`（MIT）与本文件 | 保留，作为署名 |
| 官方 `apps/web-antd`、`web-naive`、`web-tdesign`、`playground`、`docs` | 已删除 |
| 官方 `apps/web-ele` | 保留并更名为 `apps/admin`，作为本项目唯一应用 |
| 官方 `apps/backend-mock` | 已删除，改为对接真实的 framework-system-starter |

组件名与 CSS 类名刻意不改：跨上千处的机械替换收益为零、风险不低，
且保留 `Vben*` 前缀恰好让「这段代码来自哪里」在阅读时一目了然，
与 MIT 的署名要求方向一致。
