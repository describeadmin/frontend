import type { RouteRecordRaw } from 'vue-router';

import { LOGIN_PATH, NO_ACCESS_PATH } from '@describeadmin/constants';
import { preferences } from '@describeadmin/preferences';

import { $t } from '#/locales';

const BasicLayout = () => import('#/layouts/basic.vue');
const AuthPageLayout = () => import('#/layouts/auth.vue');
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
      {
        // 「当前账号没有任何可访问页面」。没分配角色、或角色一个菜单都没勾的账号，
        // 由 guard.ts 送到这里，而不是任其落进 404——见 NO_ACCESS_PATH 的注释。
        name: 'NoAccess',
        path: NO_ACCESS_PATH,
        component: () => import('#/views/_core/fallback/no-access.vue'),
        meta: {
          hideInBreadcrumb: true,
          hideInMenu: true,
          hideInTab: true,
          title: '暂无可用页面',
        },
      },
      // 全局 404 兜底。
      //
      // ⚠️ 它必须挂在 Root 下（即 BasicLayout 之内），不要再放回顶层：放在顶层时整个
      // 页面只有一张 404 插画和一个「返回首页」按钮，既没有侧边栏也没有右上角的退出
      // 入口。而「首页本身就没权限」恰恰是最容易落到 404 的情形，那个按钮点下去又跳
      // 回 404——登录着却什么都做不了，连退出重登刷新权限都不行。
      //
      // 通配路径的匹配优先级由 vue-router 按路径打分决定，与注册顺序无关，因此放在
      // children 末尾不会抢在动态路由前面（动态路由由 effects/access 的 accessible.ts
      // push 进同一个 children 数组）。
      {
        component: () => import('#/views/_core/fallback/not-found.vue'),
        meta: {
          hideInBreadcrumb: true,
          hideInMenu: true,
          hideInTab: true,
          title: '404',
        },
        name: 'FallbackNotFound',
        path: '/:path(.*)*',
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
      {
        // 强制修改密码。管理员建号 / 重置密码后，或密码过有效期，用户登录后被
        // 路由守卫钉在这里，改密成功前去不了任何其它页面（后端也会把其它请求挡成 40105）。
        name: 'PasswordResetRequired',
        path: 'password-reset-required',
        component: () =>
          import('#/views/_core/authentication/password-reset-required.vue'),
        meta: {
          hideInTab: true,
          title: '修改密码',
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

export { coreRoutes };
