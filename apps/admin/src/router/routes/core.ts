import type { RouteRecordRaw } from 'vue-router';

import { LOGIN_PATH } from '@describeadmin/constants';
import { preferences } from '@describeadmin/preferences';

import { $t } from '#/locales';

const BasicLayout = () => import('#/layouts/basic.vue');
const AuthPageLayout = () => import('#/layouts/auth.vue');
/** 全局404页面 */
const fallbackNotFoundRoute: RouteRecordRaw = {
  component: () => import('#/views/_core/fallback/not-found.vue'),
  meta: {
    hideInBreadcrumb: true,
    hideInMenu: true,
    hideInTab: true,
    title: '404',
  },
  name: 'FallbackNotFound',
  path: '/:path(.*)*',
};

/** 基本路由，这些路由是必须存在的 */
const coreRoutes: RouteRecordRaw[] = [
  /**
   * 根路由
   * 使用基础布局，作为所有页面的父级容器，子级就不必配置BasicLayout。
   * 此路由必须存在，且不应修改
   */
  {
    component: BasicLayout,
    meta: {
      hideInBreadcrumb: true,
      title: 'Root',
    },
    name: 'Root',
    path: '/',
    redirect: preferences.app.defaultHomePath,
    children: [],
  },
  {
    component: AuthPageLayout,
    meta: {
      hideInTab: true,
      title: 'Authentication',
    },
    name: 'Authentication',
    path: '/auth',
    redirect: LOGIN_PATH,
    children: [
      {
        name: 'Login',
        path: 'login',
        component: () => import('#/views/_core/authentication/login.vue'),
        meta: {
          title: $t('page.auth.login'),
        },
      },
      // docs/LOGIN_MODULE_AUDIT.md A 项：CodeLogin/QrCodeLogin/ForgetPassword/Register
      // 四条路由已删除——对应能力后端都不存在（只有 password 一种内置登录方式），
      // 留着路由意味着直接访问 URL 仍能看到一个"什么都做不了"的空白页面，
      // 只关掉 login.vue 里的入口按钮并不足够。
    ],
  },
];

export { coreRoutes, fallbackNotFoundRoute };
