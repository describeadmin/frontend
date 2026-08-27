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
    children: [
      // basic.vue 右上角头像下拉菜单「个人中心」项 router.push({ name: 'Profile' })
      // 依赖这条路由存在；此前 children 一直是空数组，点击会在控制台报
      // "No match for {"name":"Profile"}" 且无任何页面反应。
      {
        name: 'Profile',
        path: 'profile',
        component: () => import('#/views/_core/profile/index.vue'),
        meta: {
          hideInMenu: true,
          title: $t('page.auth.profile'),
        },
      },
    ],
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
      {
        // 邮箱验证码登录。前端始终注册这条路由，让"装了 framework-auth-email-starter
        // 插件就能用"成立、业务方不用改前端；入口按钮的显隐由 login.vue 的
        // :providers（/auth/providers 是否含 "email"）门控。未装插件时直达该 URL
        // 会渲染一个提交必失败的表单，这是可接受的取舍——它背后有真实的后端信号
        // 门控，不同于 CodeLogin/QrCodeLogin 那种从来没有后端的纯死壳。
        name: 'EmailLogin',
        path: 'email-login',
        component: () => import('#/views/_core/authentication/email-login.vue'),
        meta: {
          title: $t('page.auth.emailLogin'),
        },
      },
    ],
  },
];

export { coreRoutes, fallbackNotFoundRoute };
