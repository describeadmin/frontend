import type { Recordable, UserInfo } from '@describeadmin/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@describeadmin/constants';
import { preferences } from '@describeadmin/preferences';
import {
  resetAllStores,
  useAccessStore,
  useUserStore,
} from '@describeadmin/stores';

import { ElNotification } from 'element-plus';
import { defineStore } from 'pinia';

import { getMeApi, loginApi, logoutApi, toUserInfo } from '#/api';
import { resetAuthExpiredNotified } from '#/api/auth-expired-notify';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);
  // 并发去重：token 过期时页面上往往有多个请求同时收到 401，
  // authenticateResponseInterceptor 对每一个都会独立调用 doReAuthenticate → logout()。
  // 多次并发执行 resetAllStores() + router.replace() 会互相打断路由跳转，
  // 表现为“卡在原地不跳转”（同一根因见 docs/LOGIN_MODULE_AUDIT.md 改密码那条竞态记录）。
  let logoutPromise: null | Promise<void> = null;

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      const { accessToken, refreshToken } = await loginApi(params);

      // 如果成功获取到 accessToken
      if (accessToken) {
        // 将 accessToken 存储到 accessStore 中
        accessStore.setAccessToken(accessToken);
        // 上一次登录失效期间弹过的提示不该延续到这次新的登录态里
        resetAuthExpiredNotified();
        // refreshToken 可能为空（后端关闭了 describeadmin.security.refresh-token.enabled）——
        // 存 null 而不是 undefined，doRefreshToken 据此判断要不要直接引导重新登录
        accessStore.setRefreshToken(refreshToken ?? null);

        // 用户信息与权限码来自同一个 /auth/me，一次取全。
        // 上游模板在这里并发打两个接口，对我们的后端就是对同一端点请求两次
        const me = await getMeApi();
        userInfo = toUserInfo(me);

        userStore.setUserInfo(userInfo);
        accessStore.setAccessCodes(me.permissions ?? []);

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          onSuccess
            ? await onSuccess?.()
            : await router.push(
                userInfo.homePath || preferences.app.defaultHomePath,
              );
        }

        if (userInfo?.realName) {
          ElNotification({
            message: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
            title: $t('authentication.loginSuccess'),
            type: 'success',
          });
        }
      }
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true) {
    // 已有一次 logout 在执行中：直接复用它的结果，不要重新触发
    // resetAllStores()/router.replace()，避免多次并发调用互相打断跳转。
    if (logoutPromise) {
      return logoutPromise;
    }
    logoutPromise = (async () => {
      try {
        await logoutApi();
      } catch {
        // 不做任何处理
      }
      resetAllStores();
      accessStore.setLoginExpired(false);

      // 回登录页带上当前路由地址
      await router.replace({
        path: LOGIN_PATH,
        query: redirect
          ? {
              redirect: encodeURIComponent(router.currentRoute.value.fullPath),
            }
          : {},
      });
    })();
    try {
      await logoutPromise;
    } finally {
      logoutPromise = null;
    }
  }

  /**
   * 刷新页面后由路由守卫调用，用于恢复登录态。
   *
   * 权限码一并刷新：只恢复用户信息而不刷新权限码，会让「后台刚被降权的用户」
   * 在刷新页面后依然看得见本该消失的按钮。
   */
  async function fetchUserInfo() {
    const me = await getMeApi();
    const userInfo = toUserInfo(me);
    userStore.setUserInfo(userInfo);
    accessStore.setAccessCodes(me.permissions ?? []);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
