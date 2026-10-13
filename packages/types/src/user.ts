import type { BasicUserInfo } from '@describeadmin/core-typings';

/** 用户信息 */
interface UserInfo extends BasicUserInfo {
  /**
   * 用户描述
   */
  desc: string;
  /**
   * 邮箱，用户下拉菜单里显示。可能为空串
   */
  email?: string;
  /**
   * 首页地址
   */
  homePath: string;

  /**
   * accessToken
   */
  token: string;
}

export type { UserInfo };
