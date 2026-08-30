import type { RequestClient } from './request-client';
import type { MakeErrorMessageFn, ResponseInterceptorConfig } from './types';

import { $t } from '@describeadmin/locales';
import { isFunction } from '@describeadmin/utils';

import axios from 'axios';

export const defaultResponseInterceptor = ({
  codeField = 'code',
  dataField = 'data',
  successCode = 0,
}: {
  /** 响应数据中代表访问结果的字段名 */
  codeField: string;
  /** 响应数据中装载实际数据的字段名，或者提供一个函数从响应数据中解析需要返回的数据 */
  dataField: ((response: any) => any) | string;
  /** 当codeField所指定的字段值与successCode相同时，代表接口访问成功。如果提供一个函数，则返回true代表接口访问成功 */
  successCode: ((code: any) => boolean) | number | string;
}): ResponseInterceptorConfig => {
  return {
    fulfilled: (response) => {
      const { config, data: responseData, status } = response;

      if (config.responseReturn === 'raw') {
        return response;
      }

      if (status >= 200 && status < 400) {
        if (config.responseReturn === 'body') {
          return responseData;
        } else if (
          isFunction(successCode)
            ? successCode(responseData[codeField])
            : responseData[codeField] === successCode
        ) {
          return isFunction(dataField)
            ? dataField(responseData)
            : responseData[dataField];
        }
      }
      throw Object.assign({}, response, { response });
    },
  };
};

export const authenticateResponseInterceptor = ({
  client,
  doReAuthenticate,
  doRefreshToken,
  enableRefreshToken,
  formatToken,
}: {
  client: RequestClient;
  doReAuthenticate: () => Promise<void>;
  doRefreshToken: () => Promise<string>;
  enableRefreshToken: boolean;
  formatToken: (token: string) => null | string;
}): ResponseInterceptorConfig => {
  return {
    rejected: async (error) => {
      const { config, response } = error;
      // 如果不是 401 错误，直接抛出异常
      if (response?.status !== 401) {
        throw error;
      }
      // 判断是否启用了 refreshToken 功能
      // 如果没有启用或者已经是重试请求了，直接跳转到重新登录
      if (!enableRefreshToken || config.__isRetryRequest) {
        await doReAuthenticate();
        throw error;
      }
      // 如果正在刷新 token，则将请求加入队列，等待刷新完成
      if (client.isRefreshing) {
        return new Promise((resolve) => {
          client.refreshTokenQueue.push((newToken: string) => {
            config.headers.Authorization = formatToken(newToken);
            resolve(client.request(config.url, { ...config }));
          });
        });
      }

      // 标记开始刷新 token
      client.isRefreshing = true;
      // 标记当前请求为重试请求，避免无限循环
      config.__isRetryRequest = true;

      try {
        const newToken = await doRefreshToken();

        // 处理队列中的请求
        client.refreshTokenQueue.forEach((callback) => callback(newToken));
        // 清空队列
        client.refreshTokenQueue = [];

        return client.request(error.config.url, { ...error.config });
      } catch {
        // 如果刷新 token 失败，处理错误（如强制登出或跳转登录页面）
        client.refreshTokenQueue.forEach((callback) => callback(''));
        client.refreshTokenQueue = [];
        console.error('Refresh token failed, please login again.');
        await doReAuthenticate();

        // 必须抛出原始请求的 error，不能抛刷新请求自己的 refreshError：
        // 1. RequestClient.request() 在 catch 里会把 axios 错误"降级"成
        //    `error.response ? error.response.data : error`——refreshError 到这里时
        //    已经只是后端返回体本身的纯对象（没有 `.response` 这层了）。把它继续往上抛，
        //    会被下一层 errorMessageResponseInterceptor 读 `error.response.status`
        //    读成 undefined，落进 switch 的 default 分支，弹出一条文不对题的
        //    "内部服务器错误，请稍后再试"——而原始请求明明是 401。
        // 2. 语义上调用方（比如某个列表页的 getXxxApi()）关心的是"我这次请求为什么失败"，
        //    应该看到它自己这次 401 的 error，而不是内部用来换取新令牌的 /auth/refresh
        //    请求的失败详情——那是重新认证流程的内部实现细节，不该泄漏给业务调用方。
        // 上面 `!enableRefreshToken || config.__isRetryRequest` 分支已经是这么做的，
        // 这里保持一致。
        throw error;
      } finally {
        client.isRefreshing = false;
      }
    },
  };
};

export const errorMessageResponseInterceptor = (
  makeErrorMessage?: MakeErrorMessageFn,
  options?: {
    /**
     * 后端"未认证或登录已过期"的业务错误码（对应 ResultCode.UNAUTHORIZED）。
     *
     * 同一个"登录失效"语义，后端有两种不同的出场形式：
     * 1. Spring Security 拦截到的 401（access token 缺失/失效），HTTP 状态码就是 401；
     * 2. 类似 `/auth/refresh` 里主动抛的 `BizException(UNAUTHORIZED, "...")`，按项目约定
     *    `BizException` 统一映射成 HTTP 200 + 业务错误码，状态码判断不出来，只能认这里
     *    传入的业务 code。
     * 不传时只按 401 状态码识别，退化为旧行为。
     */
    unauthorizedCode?: number | string;
  },
): ResponseInterceptorConfig => {
  return {
    rejected: (error: any) => {
      if (axios.isCancel(error)) {
        return Promise.reject(error);
      }

      const err: string = error?.toString?.() ?? '';
      let errMsg = '';
      if (err?.includes('Network Error')) {
        errMsg = $t('ui.fallback.http.networkError');
      } else if (error?.message?.includes?.('timeout')) {
        errMsg = $t('ui.fallback.http.requestTimeout');
      }
      if (errMsg) {
        makeErrorMessage?.(errMsg, error);
        return Promise.reject(error);
      }

      const status = error?.response?.status;
      const bizCode = error?.response?.data?.code;
      const isAuthExpired =
        status === 401 ||
        (options?.unauthorizedCode !== undefined &&
          bizCode === options.unauthorizedCode);

      // 登录失效必须统一成一句话：两种出场形式各自的 responseData.message 措辞
      // 并不一致（比如刷新令牌失败是"刷新令牌无效或已过期，请重新登录"，原始请求的
      // 401 是"未认证或登录已过期"），如果沿用各自的后端 message，用户会在同一次
      // 登录失效事件里看到好几种不同的说法。这里提前短路、不落入下面按状态码分支的
      // switch，调用方（makeErrorMessage）也不应该再用 responseData.message 覆盖。
      if (isAuthExpired) {
        makeErrorMessage?.($t('ui.fallback.http.unauthorized'), error, {
          isAuthExpired: true,
        });
        return Promise.reject(error);
      }

      let errorMessage: string;
      switch (status) {
        case 400: {
          errorMessage = $t('ui.fallback.http.badRequest');
          break;
        }
        case 403: {
          errorMessage = $t('ui.fallback.http.forbidden');
          break;
        }
        case 404: {
          errorMessage = $t('ui.fallback.http.notFound');
          break;
        }
        case 408: {
          errorMessage = $t('ui.fallback.http.requestTimeout');
          break;
        }
        default: {
          errorMessage = $t('ui.fallback.http.internalServerError');
        }
      }
      makeErrorMessage?.(errorMessage, error);
      return Promise.reject(error);
    },
  };
};
