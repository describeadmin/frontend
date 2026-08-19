import type { RouteRecordStringComponent, UserInfo } from '@describeadmin/types';

import { requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录入参。type 之外的字段整体透传给后端对应的 AuthProvider。 */
  export interface LoginParams {
    password?: string;
    /**
     * 登录方式，取值来自 `/auth/providers`。
     *
     * 不要在前端硬编码可选值——引入浙政钉等插件后后端会自动多出一项，
     * 登录页据此动态渲染（develop_plan.md 3.2）。
     */
    type?: string;
    username?: string;
  }

  /** 后端 `LoginResult` 的原样映射。 */
  export interface BackendLoginResult {
    expiresIn: number;
    token: string;
    user: BackendLoginUser;
  }

  /** 后端 `LoginUser` 的原样映射。 */
  export interface BackendLoginUser {
    authType: string;
    nickname: string;
    permissions: string[];
    roles: string[];
    userId: number;
    username: string;
  }

  /** Vben 内核期望的登录返回结构。 */
  export interface LoginResult {
    accessToken: string;
  }
}

/** 当前后端启用了哪些登录方式。 */
export async function getAuthProvidersApi() {
  return requestClient.get<string[]>('/auth/providers');
}

/**
 * 登录。
 *
 * 后端返回 `{ token, expiresIn, user }`，Vben 内核认的是 `{ accessToken }`，
 * 差异在这一层收敛：不改后端契约去迁就框架，也不改框架内核去迁就后端。
 */
export async function loginApi(data: AuthApi.LoginParams) {
  const result = await requestClient.post<AuthApi.BackendLoginResult>(
    '/auth/login',
    { type: 'password', ...data },
  );
  return { accessToken: result.token } satisfies AuthApi.LoginResult;
}

/** 登出。后端吊销的是本次请求携带的那一个令牌，不影响该用户的其他会话。 */
export async function logoutApi() {
  return requestClient.post('/auth/logout');
}

/**
 * 当前登录用户（原始结构）。
 *
 * 每次刷新页面都回源，而不是从 localStorage 里读——存在浏览器里的角色与权限
 * 是不可信的，回源才能保证「后台刚被降权的用户」立刻失去入口。
 */
export async function getMeApi() {
  return requestClient.get<AuthApi.BackendLoginUser>('/auth/me');
}

/** 把后端的 `LoginUser` 映射成 Vben 内核认的 `UserInfo`。 */
export function toUserInfo(user: AuthApi.BackendLoginUser): UserInfo {
  return {
    avatar: '',
    desc: user.authType,
    homePath: '',
    realName: user.nickname || user.username,
    roles: user.roles ?? [],
    token: '',
    userId: String(user.userId),
    username: user.username,
  };
}

/**
 * 当前登录用户，映射为 Vben 内核认的结构。
 *
 * 登录流程走 {@link getMeApi} 一次拿全，这个函数是给路由守卫等
 * 只需要用户信息、不关心权限码的调用方用的。
 */
export async function getUserInfoApi(): Promise<UserInfo> {
  return toUserInfo(await getMeApi());
}

/**
 * 当前用户的权限码，用于 `v-access:code` 控制按钮显隐。
 *
 * 取的是后端菜单表中 BUTTON 类型节点的 `perm_code`，因此
 * 「页面上有哪些按钮」与「谁能看到这些按钮」共用同一份数据，不会各说各话。
 */
export async function getAccessCodesApi(): Promise<string[]> {
  return (await getMeApi()).permissions ?? [];
}

/** 后端 `SysMenu` 的原样映射。 */
interface BackendMenu {
  children?: BackendMenu[];
  component?: null | string;
  icon?: null | string;
  id: number;
  menuName: string;
  menuType: string;
  path?: null | string;
  sort?: null | number;
  visible?: null | number;
}

/**
 * 由路由路径派生唯一的路由 name。
 *
 * vue-router 要求 name 唯一，而后端菜单表里没有这一列——刻意不加：
 * 让业主在菜单管理界面手工维护一个「必须全局唯一且不能与前端约定冲突」的字段，
 * 是个必然出错的设计。path 本身已经唯一，从它派生即可。
 */
function routeNameOf(path: string): string {
  const cleaned = path.replaceAll(/^\/+|\/+$/g, '').replaceAll('/', '-');
  return cleaned || 'root';
}

function toRouteRecords(menus: BackendMenu[]): RouteRecordStringComponent[] {
  return menus
    // 后端 treeOf 已过滤 BUTTON，这里再挡一次：菜单数据是业主可编辑的，
    // 一个手滑把按钮建成菜单就会产生没有 component 的坏路由
    .filter((menu) => menu.menuType !== 'BUTTON' && !!menu.path)
    .map((menu) => {
      const path = menu.path as string;
      const children = toRouteRecords(menu.children ?? []);
      return {
        children: children.length > 0 ? children : undefined,
        component: menu.component ?? 'BasicLayout',
        meta: {
          hideInMenu: menu.visible === 0,
          icon: menu.icon ?? undefined,
          order: menu.sort ?? 0,
          title: menu.menuName,
        },
        name: routeNameOf(path),
        path,
      } as RouteRecordStringComponent;
    });
}

/**
 * 当前用户可见的菜单树，转成 Vben 内核认的路由结构。
 *
 * 用户 ID 取自后端的登录态而非请求参数——前端传 userId 等于任何登录用户
 * 都能拿到别人的菜单树。
 */
export async function getAllMenusApi(): Promise<RouteRecordStringComponent[]> {
  const menus = await requestClient.get<BackendMenu[]>('/auth/menus');
  return toRouteRecords(menus ?? []);
}
