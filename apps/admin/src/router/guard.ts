import type { RouteLocationResolved, Router } from 'vue-router';

import { LOGIN_PATH, NO_ACCESS_PATH } from '@describeadmin/constants';
import { preferences } from '@describeadmin/preferences';
import { useAccessStore, useUserStore } from '@describeadmin/stores';
import {
  firstReachablePath,
  startProgress,
  stopProgress,
} from '@describeadmin/utils';

import { accessRoutes, coreRouteNames } from '#/router/routes';
import { useAuthStore } from '#/store';

import { generateAccess } from './access';

/**
 * 通用守卫配置
 * @param router
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();

  router.beforeEach((to) => {
    to.meta.loaded = loadedPaths.has(to.path);

    // 页面加载进度条
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to) => {
    // 记录页面是否加载,如果已经加载，后续的页面切换动画等效果不在重复执行

    loadedPaths.add(to.path);

    // 关闭页面加载进度条
    if (preferences.transition.progress) {
      stopProgress();
    }
  });
}

/**
 * 该目标是否「没有对应的真实页面」——匹配不到任何路由，或者只匹配到了 404 兜底。
 *
 * ⚠️ 不能只判断 `matched.length === 0`：404 兜底是 `/:path(.*)*` 通配路由，任何路径都
 * 能匹配上它，`matched` 永远非空。
 */
function isUnreachable(resolved: RouteLocationResolved) {
  return (
    resolved.matched.length === 0 ||
    resolved.matched.some((record) => record.name === 'FallbackNotFound')
  );
}

/**
 * 权限访问守卫配置
 * @param router
 */
function setupAccessGuard(router: Router) {
  // 并发去重：刷新后地址栏当前路径触发的"启动导航"，和用户手速点击菜单触发的
  // "目标导航"可能几乎同时进入这里，此时 accessStore.isAccessChecked 都还是
  // false——不去重的话两次导航会各自触发一次 fetchUserInfo + generateAccess，
  // 表现为 access.ts 里"加载菜单中"提示偶发出现两次，且先进入的那次导航被后一次
  // 取代后其重定向结果直接作废，首次点击像是没反应，等竞态结束、isAccessChecked
  // 真正置为 true 后，第二次点击才会命中下面的快速路径进入页面。做法与
  // store/auth.ts 的 logoutPromise 同一个模式：缓存 in-flight 的 Promise，
  // 晚到的导航直接复用同一次执行的结果，而不是重新发起一次。
  let accessCheckPromise: null | ReturnType<typeof generateAccess> = null;

  router.beforeEach(async (to, from) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();

    // 基本路由，这些路由不需要进入权限拦截
    if (coreRouteNames.includes(to.name as string)) {
      if (to.path === LOGIN_PATH && accessStore.accessToken) {
        return decodeURIComponent(
          (to.query?.redirect as string) ||
            userStore.userInfo?.homePath ||
            preferences.app.defaultHomePath,
        );
      }
      return true;
    }

    // accessToken 检查
    if (!accessStore.accessToken) {
      // 明确声明忽略权限访问权限，则可以访问
      if (to.meta.ignoreAccess) {
        return true;
      }

      // 没有访问权限，跳转登录页面
      if (to.fullPath !== LOGIN_PATH) {
        return {
          path: LOGIN_PATH,
          // 如不需要，直接删除 query
          query:
            to.fullPath === preferences.app.defaultHomePath
              ? {}
              : { redirect: encodeURIComponent(to.fullPath) },
          // 携带当前跳转的页面，登录后重新跳转该页面
          replace: true,
        };
      }
      return to;
    }

    // 强制改密：被标记的用户只能停在强制改密页，其它任何目标都拽回去。
    // 刷新页面时 pwdResetRequired 由下方 fetchUserInfo() 恢复，那一趟先放行，
    // 生成路由后的二次导航会在这里被拦住。
    if (authStore.pwdResetRequired && to.name !== 'PasswordResetRequired') {
      return { name: 'PasswordResetRequired', replace: true };
    }

    // 是否已经生成过动态路由
    if (accessStore.isAccessChecked) {
      return true;
    }

    try {
      // 生成路由表
      // 当前登录用户拥有的角色标识列表
      const userInfo = userStore.userInfo || (await authStore.fetchUserInfo());
      const userRoles = userInfo.roles ?? [];

      // 生成菜单和路由：同一时刻只真正执行一次，后到的导航直接复用这个 Promise，
      // 不再各自调一次 generateAccess（内部会再打一次 getAllMenusApi 并重复
      // router.addRoute）。
      accessCheckPromise ??= generateAccess({
        roles: userRoles,
        router,
        // 则会在菜单中显示，但是访问会被重定向到403
        routes: accessRoutes,
      });

      // 保存菜单信息和路由信息
      const { accessibleMenus, accessibleRoutes } = await accessCheckPromise;
      accessStore.setAccessMenus(accessibleMenus);
      accessStore.setAccessRoutes(accessibleRoutes);
      accessStore.setIsAccessChecked(true);

      // 这个账号实际打得开的第一个页面。菜单树已按 sort 排好且滤掉了隐藏项，优先用它；
      // 授权里全是隐藏页（独立的新增/编辑页那类）时退到路由树取；两个都空，才是真的
      // 一个页面都进不去。
      const landingPath =
        firstReachablePath(accessibleMenus) ??
        firstReachablePath(accessibleRoutes);

      // 停在「暂无可用页面」上的账号，一旦管理员补了授权、用户刷新页面拿到了菜单，就该
      // 被放出去——否则他盯着的是一个已经不成立的提示页，而侧边栏其实已经有东西了。
      // （菜单每次都由 /auth/menus 实时查库，不受「权限快照在登录时确定」那条约束。）
      if (to.path === NO_ACCESS_PATH && landingPath) {
        return { path: landingPath, replace: true };
      }

      const redirectPath = (from.query.redirect ??
        (to.path === preferences.app.defaultHomePath
          ? userInfo.homePath || preferences.app.defaultHomePath
          : to.fullPath)) as string;
      const resolved = router.resolve(decodeURIComponent(redirectPath));

      // 目标解析不到任何真实页面（角色没设首页、设了首页却没授权该页、或干脆一个菜单
      // 都没分配）时不能就这么放行：动态路由此刻已经全部生成完毕，再往下走只会落进 404。
      if (isUnreachable(resolved)) {
        if (!landingPath) {
          // 一个页面都进不去。必须给一个带布局的提示页而不是 404——用户得看得到
          // 「重新加载 / 退出登录」，否则管理员补了角色他也没法自救。
          return { path: NO_ACCESS_PATH, replace: true };
        }
        // 只有「自动落地」才改道：登录后/刷新后回首页，以及从登录页带回来的 redirect。
        // 用户自己敲了个不存在的 URL 时保留 404 语义，不假装跳去别的页面——那个页面
        // 现在也在布局内，侧边栏和退出入口都还在，不会走投无路。
        if (
          from.query.redirect ||
          to.path === preferences.app.defaultHomePath
        ) {
          return { path: landingPath, replace: true };
        }
      }

      return {
        ...resolved,
        replace: true,
      };
    } catch (error) {
      // 最常见的原因：accessToken 已失效，fetchUserInfo() 内部的 401 已经被
      // requestClient 的 authenticateResponseInterceptor 接住，doReAuthenticate()/
      // logout() 也已经跳转到登录页了。这里必须把异常吞掉、取消当前导航（返回
      // false），不能让它冒泡成 Vue Router 的 "uncaught error during route
      // navigation"——那会被 bootstrap.ts 的兜底错误处理当成"内部服务器错误"弹出来，
      // 具有误导性：跳转登录页其实已经成功了。真正的异常仍打到控制台，不会被吃掉。
      console.error('权限守卫执行失败，已取消本次导航：', error);
      return false;
    } finally {
      accessCheckPromise = null;
    }
  });
}

/**
 * 项目守卫配置
 * @param router
 */
function createRouterGuard(router: Router) {
  /** 通用 */
  setupCommonGuard(router);
  /** 权限访问 */
  setupAccessGuard(router);
}

export { createRouterGuard };
