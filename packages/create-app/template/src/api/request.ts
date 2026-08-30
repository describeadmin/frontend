/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@describeadmin/request';

import { RESULT_CODE_UNAUTHORIZED } from '@describeadmin/constants';
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

import {
  isAuthExpiredNotified,
  markAuthExpiredNotified,
} from '#/api/auth-expired-notify';
import { refreshTokenApi } from '#/api/core/auth';
import { useAuthStore } from '#/store';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function createRequestClient(
  baseURL: string,
  options?: RequestClientOptions,
  { enableAuthRetry = true }: { enableAuthRetry?: boolean } = {},
) {
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
  // 仅在 enableAuthRetry 时挂载：/auth/refresh、/auth/logout 本身就是这套重新认证
  // 流程要调用的接口，不能再让它们自己的 401/失败又触发一轮"刷新并排队重放"，
  // 否则会在 isRefreshing 临界区内递归重入，见 authLifecycleRequestClient 的注释。
  if (enableAuthRetry) {
    client.addResponseInterceptor(
      authenticateResponseInterceptor({
        client,
        doReAuthenticate,
        doRefreshToken,
        enableRefreshToken: preferences.app.enableRefreshToken,
        formatToken,
      }),
    );
  }

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor(
      (msg: string, error, meta) => {
        // 登录失效（401 / 业务码 UNAUTHORIZED）统一走这个分支：文案由拦截器固定给出，
        // 且用 accessStore.authExpiredNotified 做跨请求去重，同一次登录失效事件只弹
        // 一次。原因：原始请求的 401 与 /auth/refresh 失败各自的 responseData.message
        // 措辞并不一致（"未认证或登录已过期" vs "刷新令牌无效或已过期，请重新登录"），
        // 并发触发时按各自 message 弹会让用户看到一堆内容不一样的提示，见
        // preset-interceptors.ts 里 isAuthExpired 分支的注释。
        if (meta?.isAuthExpired) {
          if (!isAuthExpiredNotified()) {
            markAuthExpiredNotified();
            ElMessage.error(msg);
          }
          return;
        }
        // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
        // 当前mock接口返回的错误字段是 error 或者 message
        // 后端统一返回 Result：{ code, message, data, traceId }
        const responseData = error?.response?.data ?? {};
        const errorMessage = responseData?.message ?? responseData?.error ?? '';
        // 如果没有错误信息，则会根据状态码进行提示
        ElMessage.error(errorMessage || msg);
      },
      { unauthorizedCode: RESULT_CODE_UNAUTHORIZED },
    ),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

/**
 * 认证生命周期专用客户端：只给 `refreshTokenApi`/`logoutApi` 用，**禁止**
 * 挂 `authenticateResponseInterceptor`。
 *
 * 根因（token 过期后页面不会跳转登录页的那个 bug）：`authenticateResponseInterceptor`
 * 靠 `client.isRefreshing`/`refreshTokenQueue` 这两个挂在 `client` 实例上的临界区状态
 * 判断"要不要把这次 401 排队等刷新结果"。如果 `/auth/refresh`、`/auth/logout` 也走同一个
 * 挂了这个拦截器的 `requestClient`：
 * 1. refresh 请求本身失败（含后端把 BizException 映射成 HTTP 200 + 错误码的情况）会
 *    被当成"又一次 401"处理，尝试对刷新调用本身再刷新一次令牌，逻辑上就是错的；
 * 2. 更严重的是，`doRefreshToken()` 失败后，`authenticateResponseInterceptor` 会在
 *    `catch` 块里 `await doReAuthenticate()`——这期间 `client.isRefreshing` 还是 `true`
 *    （要等这个 `catch`/`finally` 整体跑完才会被置回 `false`）。`doReAuthenticate()`
 *    内部调用的 `authStore.logout()` 会发起 `/auth/logout`，如果这个请求也 401 且也走
 *    `requestClient`，会撞上仍处于 `isRefreshing=true` 临界区的拦截器，被塞进一个
 *    "不会再被排空"的 `refreshTokenQueue`（排空只发生在它自己失败的那一刻，早于
 *    `doReAuthenticate()`），返回一个永远不会 settle 的 Promise。`logout()` 里
 *    `await logoutApi()` 因此永久挂起，后面的 `resetAllStores()`/`router.replace()`
 *    永远执行不到——表现为"控制台打完该打的日志、Toast 也弹了，但页面就是不跳转"。
 *
 * 修复方式不是"让拦截器更聪明地识别重入"，而是从根上让这两个接口不进入这套重试管线——
 * 它们本来就是这套管线失败之后才会被调用的收尾动作，不该再被同一套逻辑二次处理。
 */
export const authLifecycleRequestClient = createRequestClient(
  apiURL,
  { responseReturn: 'data' },
  { enableAuthRetry: false },
);

// system-ui 的接口函数不内置 requestClient（认证头/过期重登策略是应用层决定的事），
// 用哪个 client 由消费方在此显式注入，必须早于任何系统管理页面挂载。
provideSystemApiClient(requestClient);

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
