/**
 * 项目对外链接与品牌资源。
 *
 * 常量名保留 `VBEN_` 前缀（代码出处保留，见 NOTICE.md），但**取值必须指向本项目**——
 * 界面上显示的仓库地址、文档地址若还指着上游，是在向使用者提供错误信息。
 */

/**
 * @zh_CN GITHUB 仓库地址
 */
export const VBEN_GITHUB_URL = 'https://github.com/describeadmin/frontend';

/**
 * @zh_CN 文档地址
 */
export const VBEN_DOC_URL = 'https://github.com/describeadmin/docs';

/**
 * @zh_CN Logo。
 *
 * ⚠️ 用的是本地静态资源而不是 CDN。上游此处指向 unpkg.com，
 * 而本项目的目标部署环境（政务内网）通常没有公网出口，
 * 外链资源会表现为「logo 一直转圈或干脆不显示」，且排查时容易被误判为样式问题。
 * 新增品牌资源时一律放进 public/，不要引入任何外部 CDN。
 */
export const VBEN_LOGO_URL = '/logo.svg';

/**
 * @zh_CN 预览地址
 */
export const VBEN_PREVIEW_URL = 'https://github.com/describeadmin';
