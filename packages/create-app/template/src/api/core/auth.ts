import type {
  RouteRecordStringComponent,
  UserInfo,
} from '@describeadmin/types';

import { avatarUrl } from '@describeadmin/system-ui';

import { authLifecycleRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录入参。type 之外的字段整体透传给后端对应的 AuthProvider。 */
  export interface LoginParams {
    /** 达到渐进式验证码的触发阈值后必填；未达阈值时后端忽略这两个字段。 */
    captchaCode?: string;
    captchaId?: string;
    password?: string;
    /**
     * 登录方式，取值来自 `/auth/providers`。
     *
     * 不要在前端硬编码可选值——引入浙政钉等插件后后端会自动多出一项，
     * 登录页据此动态渲染。
     */
    type?: string;
    username?: string;
  }

  /**
   * 后端 `CaptchaChallenge` 的原样映射。
   *
   * `type` 由后端 `describeadmin.security.captcha.type` 决定，核心内置两种：
   * - `"pow"`（默认）：`payload` 为 `{ algorithm, salt, challenge, maxNumber }`，
   *   交给 `@describeadmin/utils` 的 `solvePow` 求解，答案作为 `captchaCode` 提交
   * - `"image"`：`payload.image` 是 `data:image/png;base64,...`
   *
   * 后端换成滑块/第三方验证码插件后会出现别的取值，前端应按 `type` 分支渲染。
   */
  export interface CaptchaChallenge {
    captchaId: string;
    payload: Record<string, any>;
    type: string;
  }

  /** 后端 `LoginResult` 的原样映射。 */
  export interface BackendLoginResult {
    expiresIn: number;
    refreshExpiresIn?: number;
    /**
     * 刷新令牌，`describeadmin.security.refresh-token.enabled=false` 时为空。
     * 为空时不应该再调用 {@link refreshTokenApi}，应直接引导用户重新登录。
     */
    refreshToken?: string;
    token: string;
    user: BackendLoginUser;
  }

  /** 后端 `LoginUser` 的原样映射。 */
  export interface BackendLoginUser {
    authType: string;
    /** 按角色合并出的默认首页路径，未设置时为 null，由前端落回全局 defaultHomePath。 */
    homePath?: null | string;
    /** 登录时定格在令牌里的快照，自助改了姓名也不会变——显示用 {@link MeProfile.nickname}。 */
    nickname: string;
    permissions: string[];
    /**
     * 只有 `GET /auth/me` 带，登录响应里的 `user` 没有。每次请求实时读库；
     * 业务方自己提供 `AuthUserLoader`、用户不在 `sys_user` 里时为 null。
     */
    profile?: MeProfile | null;
    /**
     * 是否要求先强制修改密码：管理员建号 / 重置密码后为 true，或密码已过
     * `sys.password.max-age-days` 设定的有效期。为 true 时前端只能进强制改密页，
     * 后端 `PasswordResetRequiredFilter` 也会把其它请求挡成 40105。
     */
    pwdResetRequired?: boolean;
    roles: string[];
    /** 后端把 Long 序列化成字符串，避免雪花 ID 被 JS 舍入。 */
    userId: string;
    username: string;
  }

  /** `GET /auth/me` 里实时读库的那部分资料，见后端 `AuthController.MeView`。 */
  export interface MeProfile {
    /** 头像的对象键，不是 URL——用 `avatarUrl()` 转换。 */
    avatar?: null | string;
    email?: null | string;
    nickname?: null | string;
  }

  /** Vben 内核期望的登录返回结构。 */
  export interface LoginResult {
    accessToken: string;
    refreshToken?: string;
  }

  /**
   * 后端 `GET /api/auth/profile` 返回的当前用户资料（个人中心-基本设置用）。
   *
   * 只建模用得到的字段——后端直接返回 `SysUser` 实体，还带 deptId/status 等
   * 个人中心不关心的字段，原样透传即可，不必逐个补全类型。
   */
  export interface OwnProfile {
    email?: null | string;
    id: string;
    mobile?: null | string;
    nickname: string;
    username: string;
  }
}

/** 当前后端启用了哪些登录方式。 */
export async function getAuthProvidersApi() {
  return requestClient.get<string[]>('/auth/providers');
}

/**
 * 获取一次新的验证码挑战。
 *
 * 对应后端 `GET /api/auth/captcha`，免认证——登录之前显然还没有令牌。
 * 挑战一次性：提交过一次（无论对错）即作废，下次提交前要重新获取。
 */
export async function getCaptchaApi() {
  return requestClient.get<AuthApi.CaptchaChallenge>('/auth/captcha');
}

/**
 * 发送邮箱登录验证码。
 *
 * 对应 framework-auth-email-starter 插件的 `POST /api/auth/email/code`——
 * 该端点在后端 permit-all 白名单里，因此不需要携带登录态即可调用。
 * 无论邮箱是否已注册，只要没有触发限流都会返回成功（防账号枚举），
 * 前端不应该据此判断"这个邮箱是不是已经注册过"。
 *
 * 未引入邮箱插件时后端没有这个端点，调用会 404——邮箱登录入口本身
 * 由 `/auth/providers` 是否含 `email` 门控（见 login.vue），正常不会走到这里。
 */
export async function sendEmailCodeApi(email: string) {
  return requestClient.post('/auth/email/code', { email });
}

/**
 * 登录。
 *
 * 后端返回 `{ token, expiresIn, user }`，Vben 内核认的是 `{ accessToken }`，
 * 差异在这一层收敛：不改后端契约去迁就框架，也不改框架内核去迁就后端。
 * `refreshToken` 一并透传——后端关闭了刷新令牌开关时这里是 `undefined`，
 * 调用方（store/auth.ts）据此决定要不要存。
 */
export async function loginApi(data: AuthApi.LoginParams) {
  const result = await requestClient.post<AuthApi.BackendLoginResult>(
    '/auth/login',
    { type: 'password', ...data },
  );
  return {
    accessToken: result.token,
    refreshToken: result.refreshToken,
  } satisfies AuthApi.LoginResult;
}

/**
 * 用 refresh token 换发新的 access/refresh 令牌对。
 *
 * 对应后端 `POST /api/auth/refresh`——该端点本身免认证（挂权限校验会自相矛盾，
 * 见 AuthController 的注释），校验完全下沉在后端 `TokenStore.refresh()` 内部。
 *
 * **必须用 `authLifecycleRequestClient`，不能用 `requestClient`**：这个调用本身就是
 * `authenticateResponseInterceptor` 失败之后触发的收尾动作，若再挂同一套拦截器会在
 * `isRefreshing` 临界区内递归重入，详见 `authLifecycleRequestClient` 处的注释。
 */
export async function refreshTokenApi(refreshToken: string) {
  return authLifecycleRequestClient.post<AuthApi.BackendLoginResult>(
    '/auth/refresh',
    { refreshToken },
  );
}

/**
 * 登出。后端吊销的是本次请求携带的那一个令牌，不影响该用户的其他会话。
 *
 * 同 {@link refreshTokenApi}，必须用 `authLifecycleRequestClient`：token 过期触发的
 * 自动重新登录会在令牌已清空的情况下调用这里，此时 401 是预期结果，不能再被
 * `authenticateResponseInterceptor` 排队等待一次不会再发生的令牌刷新。
 */
export async function logoutApi() {
  return authLifecycleRequestClient.post('/auth/logout');
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

/**
 * 把后端的 `LoginUser` 映射成 Vben 内核认的 `UserInfo`。
 *
 * 姓名、邮箱、头像优先取 `profile`（实时读库），没有时才回落到令牌快照——
 * 否则自助改了姓名，刷新页面后顶栏还是旧名字，要重新登录才变。
 * 没有头像时 `avatar` 为空串，显示处用 `||` 回落到默认头像（`??` 拦不住空串）。
 */
export function toUserInfo(user: AuthApi.BackendLoginUser): UserInfo {
  const profile = user.profile;
  return {
    avatar: avatarUrl(profile?.avatar),
    desc: user.authType,
    email: profile?.email ?? '',
    homePath: user.homePath ?? '',
    realName: profile?.nickname || user.nickname || user.username,
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
  const me = await getMeApi();
  return me.permissions ?? [];
}

/**
 * 当前登录用户的完整资料（姓名/手机号/邮箱），个人中心-基本设置回显用。
 *
 * 与 {@link getMeApi} 的区别：`LoginUser` 是跨登录方式共享的鉴权对象，不带 mobile/email
 * 这类具体业务字段；这里对应后端专门给个人中心开的 `GET /api/auth/profile`。
 */
export async function getOwnProfileApi() {
  return requestClient.get<AuthApi.OwnProfile>('/auth/profile');
}

/**
 * 自助修改姓名/手机号/邮箱。
 *
 * 用户名与角色不接受在这里修改——后端 `PUT /api/auth/profile` 本身就只读取这三个字段，
 * 传别的字段也不会生效，因此前端也不提供对应的输入项。
 */
export async function updateOwnProfileApi(data: {
  email?: string;
  mobile?: string;
  nickname: string;
}) {
  return requestClient.put('/auth/profile', data);
}

/**
 * 自助换头像，返回新的对象键。传入的文件应先经过 `compressAvatar()`。
 *
 * 用 `requestClient.upload`，自动带上令牌；读取端点则免登录，见 `avatarUrl()`。
 */
export async function uploadOwnAvatarApi(file: File) {
  return requestClient.upload<string>('/auth/avatar', { file });
}

/** 自助移除头像。 */
export async function removeOwnAvatarApi() {
  return requestClient.delete('/auth/avatar');
}

/**
 * 自助修改密码。
 *
 * 成功后后端会吊销当前用户的全部令牌（含发起本次请求所用的这一个），
 * 调用方必须紧接着引导用户用新密码重新登录，不能指望原地继续使用旧的登录态。
 */
export async function changePasswordApi(
  oldPassword: string,
  newPassword: string,
) {
  return requestClient.put('/auth/password', {
    newPassword,
    oldPassword,
  });
}

/** 后端 `SysMenu` 的原样映射。 */
interface BackendMenu {
  /** 侧边栏高亮路径，隐藏页面用它把选中态落回所属菜单。 */
  activePath?: null | string;
  children?: BackendMenu[];
  component?: null | string;
  icon?: null | string;
  /** 同 userId：后端统一把 Long 序列化成字符串。 */
  id: string;
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
  return (
    menus
      // 不可路由的节点（BUTTON，或没填 path 的目录）不生成路由，但**它的子节点要提升
      // 到本层**，不能连同整棵子树一起丢掉。
      //
      // 后端 treeOf 已过滤 BUTTON，这里再挡一次：菜单数据是业主可编辑的，一个手滑把
      // 按钮建成菜单就会产生没有 component 的坏路由。而「目录没填 path」是完全合法的
      // 输入——SysMenuService.normalizeBlankToNull 会把空串归一成 NULL，没有任何校验
      // 要求 DIR 必须有 path。
      //
      // ⚠️ 这里过去是 filter + map，于是那种目录会连它下面的所有页面一起消失：children
      // 只能经父节点递归取得，父节点被跳过，子树就再也回不来了。症状是「明明授权了，
      // 侧边栏没有、敲 URL 落 404」，而排查方向会指向授权而不是那个空 path。
      // 角色授权改为自动补齐祖先（SysRoleService.assignMenus）之后这条路径更容易被走到：
      // 在那之前父目录往往根本不在授权集合里，孤儿节点被 TreeBuilder 提升为根反而躲开了。
      .flatMap((menu) => {
        const children = toRouteRecords(menu.children ?? []);
        if (menu.menuType === 'BUTTON' || !menu.path) {
          return children;
        }
        const path = menu.path;
        const isContainer = children.length > 0;
        return [
          {
            children: isContainer ? children : undefined,
            // 有子菜单的节点只是路由容器，不下发页面组件——子页面透传到父级
            // <router-view>，vue-router 会自动跳过这一层。框架的 generateAccessible
            // 只对「顶层」容器 delete component（见 effects/access/src/accessible.ts），
            // 三级及以上的中间容器不归它管；这里若兜底成 'BasicLayout'，就会在
            // BasicLayout 里再套一层 BasicLayout，侧边栏 / 头部重复渲染，页面布局错乱。
            component: isContainer
              ? undefined
              : (menu.component ?? 'BasicLayout'),
            meta: {
              // 隐藏页面（独立的新增/编辑页）把侧边栏选中态落回所属列表菜单，
              // 否则进去之后侧边栏一项都不高亮、面包屑也断在父级。
              activePath: menu.activePath ?? undefined,
              // visible=0 只是不进侧边栏，路由照常生成——能不能访问由后端授权决定。
              hideInMenu: menu.visible === 0,
              icon: menu.icon ?? undefined,
              order: menu.sort ?? 0,
              title: menu.menuName,
            },
            name: routeNameOf(path),
            path,
          } as RouteRecordStringComponent,
        ];
      })
  );
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
