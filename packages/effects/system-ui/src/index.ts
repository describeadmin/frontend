import type { ComponentRecordType } from '@describeadmin/types';

export * from './api';

/**
 * 系统管理页面组件的路由 key → 懒加载组件 映射。
 *
 * key 必须与 framework-system-starter 的 seed-rbac.sql（以及 codegen 产出的
 * menu-*.sql）里 `sys_menu.component` 字段规范化后的结果精确一致——`component`
 * 填的是不带 `.vue` 的相对路径（如 `system/dept/index`），经
 * `generateRoutesByBackend` 的 normalizeViewPath 规范化（去掉 `./`/`../` 前缀、
 * 补前导 `/`、剥掉前导 `/views`）后即为下面这些 key，`.vue` 后缀不受该函数影响。
 *
 * 消费方（应用外壳）把这份 map 展开合并进自己的 `pageMap`：
 *
 * ```ts
 * const pageMap: ComponentRecordType = {
 *   ...import.meta.glob('../views/**\/*.vue'),
 *   ...systemPageMap,
 * };
 * ```
 */
export const systemPageMap: ComponentRecordType = {
  '/dashboard/index.vue': () => import('./views/dashboard/index.vue'),
  '/system/dept/index.vue': () => import('./views/dept/index.vue'),
  '/system/menu/index.vue': () => import('./views/menu/index.vue'),
  '/system/role/index.vue': () => import('./views/role/index.vue'),
  '/system/user/index.vue': () => import('./views/user/index.vue'),
};
