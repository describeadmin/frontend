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
     * access token 过期后用 refresh token 静默续期并重放原请求（src/api/request.ts 的 doRefreshToken），
     * 用户无感。后端 describeadmin.security.refresh-token.enabled=false 时这里也要关掉。
     */
    enableRefreshToken: true,

    name: import.meta.env.VITE_APP_TITLE,
  },

  /**
   * 页脚版权信息，默认不显示。框架不预填任何单位名称，由部署方填自己的：
   *
   * copyright: {
   *   enable: true,
   *   companyName: '某某市大数据局',
   *   companySiteLink: 'https://example.gov.cn',
   *   date: '2026',
   *   icp: '某ICP备XXXXXXXX号',
   *   icpLink: 'https://beian.miit.gov.cn',
   * },
   *
   * 这一段改了即生效，不受浏览器偏好缓存影响。
   */
});
