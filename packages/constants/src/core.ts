/**
 * @zh_CN 登录页面 url 地址
 */
export const LOGIN_PATH = '/auth/login';

/**
 * 后端"未认证或登录已过期"的业务错误码，对应 ResultCode.UNAUTHORIZED（40100）。
 *
 * 用于识别 HTTP 200 + 该业务码这种形式的登录失效（如 /auth/refresh 刷新失败）——
 * 这类响应用 HTTP 状态码判断不出来，只能认业务 code。真正的 401（Spring Security
 * 拦截到的未认证请求）走 HTTP 状态码判断，不依赖这个常量。
 * 两者共同交给 errorMessageResponseInterceptor 的 unauthorizedCode 选项识别，
 * 统一收口成一句提示文案，见 preset-interceptors.ts。
 */
export const RESULT_CODE_UNAUTHORIZED = 40_100;

export interface LanguageOption {
  label: string;
  value: 'en-US' | 'zh-CN';
}

/**
 * Supported languages
 */
export const SUPPORT_LANGUAGES: LanguageOption[] = [
  {
    label: '简体中文',
    value: 'zh-CN',
  },
  {
    label: 'English',
    value: 'en-US',
  },
];
