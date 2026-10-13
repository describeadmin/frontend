/**
 * @zh_CN 登录页面 url 地址
 */
export const LOGIN_PATH = '/auth/login';

/**
 * @zh_CN 「当前账号没有任何可访问页面」的提示页地址
 *
 * 没有被分配任何角色（或角色一个菜单都没勾）的账号，进系统后没有任何路由可落地。
 * 此前这种账号会被甩到全局 404——那个页面在布局之外，没有侧边栏也没有退出入口，
 * 「返回首页」又会再跳回 404，非技术用户连退出重登都做不到。改为落到本页面：
 * 它在 BasicLayout 之内，且自带「重新加载 / 退出登录」两个出口。
 */
export const NO_ACCESS_PATH = '/no-access';

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

/**
 * 后端"需要验证码"的业务错误码，对应 ResultCode.CAPTCHA_REQUIRED（40103）。
 *
 * 只由登录接口返回，且由登录页自己处理（PoW 自动求解重提 / 图形验证码显示输入框），
 * 因此请求层的通用错误提示对它静默——否则 PoW 自动重提成功前会先闪一条"需要验证码"。
 */
export const RESULT_CODE_CAPTCHA_REQUIRED = 40_103;

/** 后端"验证码错误或已过期"的业务错误码，对应 ResultCode.CAPTCHA_INVALID（40104）。 */
export const RESULT_CODE_CAPTCHA_INVALID = 40_104;

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
