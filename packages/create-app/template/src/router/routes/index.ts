import type { RouteRecordRaw } from 'vue-router';

import { mergeRouteModules, traverseTreeValues } from '@describeadmin/utils';

import { coreRoutes, fallbackNotFoundRoute } from './core';

const dynamicRouteFiles = import.meta.glob('./modules/**/*.ts', {
  eager: true,
});

// 有需要可以自行打开注释，并创建文件夹
// const externalRouteFiles = import.meta.glob('./external/**/*.ts', { eager: true });
// const staticRouteFiles = import.meta.glob('./static/**/*.ts', { eager: true });

/** 动态路由 */
const dynamicRoutes: RouteRecordRaw[] = mergeRouteModules(dynamicRouteFiles);

/** 外部路由列表，访问这些页面可以不需要Layout，可能用于内嵌在别的系统(不会显示在菜单中) */
// const externalRoutes: RouteRecordRaw[] = mergeRouteModules(externalRouteFiles);
// const staticRoutes: RouteRecordRaw[] = mergeRouteModules(staticRouteFiles);
const staticRoutes: RouteRecordRaw[] = [];
const externalRoutes: RouteRecordRaw[] = [];

/** 路由列表，由基本路由、外部路由和404兜底路由组成
 *  无需走权限验证（会一直显示在菜单中） */
const routes: RouteRecordRaw[] = [
  ...coreRoutes,
  ...externalRoutes,
  fallbackNotFoundRoute,
];

/**
 * 基本路由列表，这些路由不需要进入权限拦截。
 *
 * ⚠️ 只收集 Root 自身与 /auth 子树，遍历前刻意把 Root 的 children 摘掉——
 * Root 下的业务子路由（Profile 等）**必须**走权限流程。
 *
 * 原因：guard.ts 命中这份白名单就直接 return true，而这个早退发生在
 * generateAccess() 之前；accessMenus 又不持久化（stores/modules/access.ts 的
 * persist.pick 不含它）。于是直接刷新 /profile 会得到「页面渲染正常、侧边栏一个
 * 菜单都没有」——顺带动态路由也没注册、面包屑为空、未登录敲 URL 还能看到空壳布局。
 * traverseTreeValues 是深度遍历，Profile 挂在 Root.children 下就会被收进来。
 */
const coreRouteNames = traverseTreeValues(
  coreRoutes.map((route) =>
    route.name === 'Root' ? { ...route, children: [] } : route,
  ),
  (route) => route.name,
);

/** 有权限校验的路由列表，包含动态路由和静态路由 */
const accessRoutes = [...dynamicRoutes, ...staticRoutes];
export { accessRoutes, coreRouteNames, routes };
