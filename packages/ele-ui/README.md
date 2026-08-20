# @describeadmin/ele-ui

绑定 Element Plus 的框架通用组件。

## 为什么单独一层，而不是放进 `@describeadmin/ui`

`packages/@core/*` 与 `packages/effects/*` 全部**不依赖任何 UI 组件库**——这是取材自 Vben 的既有不变量（内核基于 reka-ui，由 `apps/` 选择 UI 库）。本包及 `@describeadmin/system-ui` 是**唯一显式依赖 Element Plus 的一层**，把这条依赖隔离在名字上看得出来的地方，而不是渗进 26 个 UI 库无关的包里。

`element-plus` 与 `vue` 声明为 `peerDependencies`：由业务方的应用提供单一实例，避免同一页面里出现两份 Element Plus。

## 组件

| 组件            | 说明                                                     |
| --------------- | -------------------------------------------------------- |
| `ConfirmDialog` | 受控的删除确认框。**codegen 生成的每个业务页面都会用它** |
