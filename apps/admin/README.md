# describeadmin admin（playground）

**这个应用是框架自己的联调 playground，不是你的起点。**

> ⚠️ **要新建工程，用脚手架，别 fork 这个目录**：
>
> ```bash
> npm create @describeadmin/app my-app
> ```
>
> 生成的是收走了系统管理四页面（`@describeadmin/system-ui`）之后的薄外壳，只保留 router/access/layouts/adapter 装配这些每个应用都要有、但框架不该替你做决定的部分。从本目录复制的话，你还要回头删掉这一层已经不需要你操心的东西。

本应用的用途是：本地 `pnpm -F @describeadmin/admin dev` 时，给 `packages/*` 一个真实能跑起来的宿主——路由、权限、系统管理页面全部通过依赖 `@describeadmin/system-ui`、`@describeadmin/access` 等包获得，框架团队自己也在用这个应用验证包是否真的可用（"吃自己的狗粮"）。

它连接真实后端（`sample-app`，或业务方自己的后端），不带 mock。

## 跑起来

```bash
pnpm -F @describeadmin/admin dev
```

默认代理到本地 `sample-app`（监听 8090），登录账号见 `sample-app` 的说明。
