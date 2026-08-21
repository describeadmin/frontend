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
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);

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
      const { accessToken } = await loginApi(params);

      // 如果成功获取到 accessToken
      if (accessToken) {
        // 将 accessToken 存储到 accessStore 中
        accessStore.setAccessToken(accessToken);

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
