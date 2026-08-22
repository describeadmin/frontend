/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@describeadmin/request';

import { useAppConfig } from '@describeadmin/hooks';
import { preferences } from '@describeadmin/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@describeadmin/request';
import { useAccessStore } from '@describeadmin/stores';
import { provideSystemApiClient } from '@describeadmin/system-ui';

import { ElMessage } from 'element-plus';

import { refreshTokenApi } from '#/api/core/auth';
import { useAuthStore } from '#/store';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await authStore.logout();
    }
  }

  /**
   * 刷新 token 逻辑。
   *
   * docs/LOGIN_MODULE_AUDIT.md E 项：后端已实现 access/refresh 双令牌（
   * framework-security-starter 的 TokenStore.issueWithRefresh/refresh），
   * 这里从"确定会抛错的桩实现"换成真实调用。`authenticateResponseInterceptor`
   * 的排队重放逻辑本身是现成的，不用改——只是此前一直没有真正被触发过。
   *
   * refreshToken 为空（后端 describeadmin.security.refresh-token.enabled=false，
   * 或本次登录走的 provider 未支持）时直接抛错，让调用方走 doReAuthenticate 强制重登，
   * 而不是拿 null 去请求后端换来一个更难懂的 400。
   */
  async function doRefreshToken(): Promise<string> {
    const accessStore = useAccessStore();
    const refreshToken = accessStore.refreshToken;
    if (!refreshToken) {
      throw new Error('没有可用的 refresh token，需要重新登录。');
    }
    const result = await refreshTokenApi(refreshToken);
    accessStore.setAccessToken(result.token);
    accessStore.setRefreshToken(result.refreshToken ?? null);
    return result.token;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      return config;
    },
  });

  // 处理返回的响应数据格式
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode: 0,
    }),
  );

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
      // 当前mock接口返回的错误字段是 error 或者 message
      // 后端统一返回 Result：{ code, message, data, traceId }
      const responseData = error?.response?.data ?? {};
      const errorMessage = responseData?.message ?? responseData?.error ?? '';
      // 如果没有错误信息，则会根据状态码进行提示
      ElMessage.error(errorMessage || msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

// system-ui 的接口函数不内置 requestClient（认证头/过期重登策略是应用层决定的事），
// 用哪个 client 由消费方在此显式注入，必须早于任何系统管理页面挂载。
provideSystemApiClient(requestClient);

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
