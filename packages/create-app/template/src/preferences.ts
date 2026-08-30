import { defineOverridesPreferences } from '@describeadmin/preferences';

/**
 * 项目配置。只覆盖需要改的部分，其余走默认值。
 *
 * !!! 改完请清空浏览器缓存，偏好会被持久化到 localStorage，否则可能不生效。
 */
export const overridesPreferences = defineOverridesPreferences({
  app: {
    /**
     * 权限模式：菜单与路由由后端下发。
     *
     * 上游默认是 `frontend`（路由写死在前端、按角色过滤）。本项目必须用 `backend`：
     * 菜单表是业主可维护的数据，「加一个菜单要改前端代码再发一次版」在政务项目里不可接受。
     * 同一份 sys_menu 既生成路由、又提供按钮级权限点，两者不会各说各话。
     */
    accessMode: 'backend',

    /**
     * 默认首页。
     *
     * ⚠️ backend 模式下前端的静态路由模块**完全不参与**路由生成，
     * 因此这里只能填菜单表里真实存在的路径。上游默认的 '/analytics' 来自
     * 前端静态路由，在 backend 模式下登录后会直接落到 404（实测踩过）。
     */
    defaultHomePath: '/dashboard/workbench',

    /**
     * docs/LOGIN_MODULE_AUDIT.md E 项：后端已实现 access/refresh 双令牌，
     * src/api/request.ts 的 doRefreshToken 已从桩实现换成真实调用，这里随之打开。
     */
    enableRefreshToken: true,

    name: import.meta.env.VITE_APP_TITLE,
  },
});
