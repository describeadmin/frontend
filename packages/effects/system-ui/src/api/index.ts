/**
 * 系统管理接口。
 *
 * 全部由 framework-system-starter 提供，业务方引入依赖即拥有，无需自己实现。
 *
 * `list` / `get` / `create` / `update` / `remove` 五个端点来自后端的
 * `BaseController`，各模块形状一致；模块特有的接口（分配角色、菜单树等）
 * 单独列在各自的段落里。
 *
 * 无返回体的接口不写 `<void>` 泛型：`void` 只在返回类型位置合法，作为类型实参
 * 会被 `@typescript-eslint/no-invalid-void-type` 拦下。省略泛型即可，
 * 调用方本来也不该用这些接口的返回值。
 */
import type {
  ActiveSession,
  OptionItem,
  PageQuery,
  PageResult,
  SysConfig,
  SysDept,
  SysDictData,
  SysDictType,
  SysMenu,
  SysOperLog,
  SysRole,
  SysUser,
} from './types';

import { getSystemApiClient } from './client';

export * from './client';
export * from './types';

// --------------------------------------------------------------------- 用户

export interface UserQuery extends PageQuery {
  deptId?: number;
  mobile?: string;
  nickname?: string;
  status?: number;
  username?: string;
}

export async function getUserListApi(params: UserQuery) {
  return getSystemApiClient().get<PageResult<SysUser>>('/system/user', {
    params,
  });
}

/**
 * 新增用户。
 *
 * 走的是 `/with-password` 而不是通用的 POST /system/user —— 后端刻意让通用
 * 端点在创建用户时抛错，避免任何路径下把明文密码当普通字段写进库。
 */
export async function createUserApi(
  data: SysUser & { password: string; roleIds?: number[] },
) {
  return getSystemApiClient().post<SysUser>('/system/user/with-password', data);
}

export async function updateUserApi(id: number, data: SysUser) {
  return getSystemApiClient().put<SysUser>(`/system/user/${id}`, data);
}

export async function deleteUserApi(id: number) {
  return getSystemApiClient().delete(`/system/user/${id}`);
}

export async function resetUserPasswordApi(id: number, password: string) {
  return getSystemApiClient().put(`/system/user/${id}/password`, { password });
}

export async function getUserRolesApi(id: number) {
  return getSystemApiClient().get<number[]>(`/system/user/${id}/roles`);
}

export async function assignUserRolesApi(id: number, roleIds: number[]) {
  return getSystemApiClient().put(`/system/user/${id}/roles`, roleIds);
}

// --------------------------------------------------------------------- 角色

export interface RoleQuery extends PageQuery {
  roleCode?: string;
  roleName?: string;
}

export async function getRoleListApi(params: RoleQuery) {
  return getSystemApiClient().get<PageResult<SysRole>>('/system/role', {
    params,
  });
}

/**
 * 角色选项，供别的模块的选择器使用（用户管理的角色下拉、「分配角色」弹窗）。
 *
 * **别用 `getRoleListApi({ current: 1, size: 200 })` 代替它。** 那是把分页接口当全量
 * 接口使，角色超过 200 条就静默丢数据；而且调大 `size` 也没用——后端 `PageQuery.MAX_SIZE`
 * 是 500，在入口就夹紧了。本接口不分页，超过上限会明确报错而不是悄悄截断。
 *
 * 只要求登录、不挂权限点，所以「只授用户管理」的角色也能填出这个下拉，
 * 且不必为此被授予 `system:role:list`（那会让侧边栏多出「角色管理」入口）。
 *
 * @param keyword 角色名前缀，可选；不传返回全量
 */
export async function getRoleOptionsApi(keyword?: string) {
  return getSystemApiClient().get<OptionItem[]>('/system/role/options', {
    params: keyword ? { keyword } : undefined,
  });
}

/**
 * 可授予的完整菜单树（含 BUTTON 权限点，带 `menuType`/`path`），
 * 供「分配菜单」弹窗与角色表单的「首页」选择器使用。
 *
 * 这个端点开在**角色模块**上、按 `system:role:list` 校验：分配菜单是角色管理自己的功能，
 * 它需要的数据就该由角色模块提供。过去这里调 `getMenuTreeApi()`，那要求
 * `system:menu:list`，于是"能管角色"和"能看菜单管理"被迫捆绑。
 *
 * 之所以不走 `/options`：通用 `OptionItem` 形状带不了 `menuType`/`path`，
 * 而「首页」选择器要靠它们判断哪些节点可选。判据见 CLAUDE.md 4.11。
 */
export async function getRoleGrantableMenusApi() {
  return getSystemApiClient().get<SysMenu[]>('/system/role/grantable-menus');
}

export async function createRoleApi(data: SysRole) {
  return getSystemApiClient().post<SysRole>('/system/role', data);
}

export async function updateRoleApi(id: number, data: SysRole) {
  return getSystemApiClient().put<SysRole>(`/system/role/${id}`, data);
}

export async function deleteRoleApi(id: number) {
  return getSystemApiClient().delete(`/system/role/${id}`);
}

/** 该角色自定义数据权限的部门 id 列表，只在 `dataScope === CUSTOM(2)` 时有意义。 */
export async function getRoleDeptsApi(id: number) {
  return getSystemApiClient().get<number[]>(`/system/role/${id}/depts`);
}

/** 整体覆盖角色的自定义数据权限部门列表，与 {@link assignRoleMenusApi} 同一"重建"语义。 */
export async function assignRoleDeptsApi(id: number, deptIds: number[]) {
  return getSystemApiClient().put(`/system/role/${id}/depts`, deptIds);
}

export async function getRoleMenusApi(id: number) {
  return getSystemApiClient().get<number[]>(`/system/role/${id}/menus`);
}

export async function assignRoleMenusApi(id: number, menuIds: number[]) {
  return getSystemApiClient().put(`/system/role/${id}/menus`, menuIds);
}

// --------------------------------------------------------------------- 菜单

/**
 * 全量菜单树（含 BUTTON 权限点），需要 `system:menu:list`。
 *
 * 只给**菜单管理页自己**用。别的模块要引用菜单，走 {@link getMenuOptionsApi}；
 * 角色授权走 {@link getRoleGrantableMenusApi}——都不需要菜单模块的权限点。
 */
export async function getMenuTreeApi() {
  return getSystemApiClient().get<SysMenu[]>('/system/menu/tree');
}

/**
 * 菜单选项树，供「上级菜单」这类引用选择器使用。仅要求登录。
 *
 * 只含目录与菜单（**不含按钮**，按钮不是可挂载的节点），只下发 id + 名称。
 */
export async function getMenuOptionsApi() {
  return getSystemApiClient().get<OptionItem[]>('/system/menu/options');
}

export async function createMenuApi(data: SysMenu) {
  return getSystemApiClient().post<SysMenu>('/system/menu', data);
}

export async function updateMenuApi(id: number, data: SysMenu) {
  return getSystemApiClient().put<SysMenu>(`/system/menu/${id}`, data);
}

export async function deleteMenuApi(id: number) {
  return getSystemApiClient().delete(`/system/menu/${id}`);
}

// --------------------------------------------------------------------- 部门

/**
 * 全量部门树（含负责人、电话、物化路径），需要 `system:dept:list`。
 *
 * 只给**部门管理页自己**用。别的模块要引用部门，走 {@link getDeptOptionsApi}。
 */
export async function getDeptTreeApi() {
  return getSystemApiClient().get<SysDept[]>('/system/dept/tree');
}

/**
 * 部门选项树，供别的模块的选择器使用（用户表单的「部门」、角色的「分配数据权限」）。
 * 仅要求登录，只下发 id + 名称 + 禁用态。
 *
 * 停用的部门带 `disabled: true` 而不是被滤掉——直接滤掉的话，已在该部门下的用户
 * 一打开编辑表单，部门就显示为空，看起来像"这个人没有部门"，保存一次就真没了。
 */
export async function getDeptOptionsApi() {
  return getSystemApiClient().get<OptionItem[]>('/system/dept/options');
}

export async function createDeptApi(data: SysDept) {
  return getSystemApiClient().post<SysDept>('/system/dept', data);
}

export async function updateDeptApi(id: number, data: SysDept) {
  return getSystemApiClient().put<SysDept>(`/system/dept/${id}`, data);
}

export async function deleteDeptApi(id: number) {
  return getSystemApiClient().delete(`/system/dept/${id}`);
}

// ------------------------------------------------------------------- 字典类型

export interface DictTypeQuery extends PageQuery {
  /** 同时对字典名称、字典类型做 OR 匹配的组合搜索框，见 dict/index.vue。 */
  keyword?: string;
  dictName?: string;
  dictType?: string;
  status?: number;
}

export async function getDictTypeListApi(params: DictTypeQuery) {
  return getSystemApiClient().get<PageResult<SysDictType>>(
    '/system/dict/type',
    {
      params,
    },
  );
}

export async function createDictTypeApi(data: SysDictType) {
  return getSystemApiClient().post<SysDictType>('/system/dict/type', data);
}

export async function updateDictTypeApi(id: number, data: SysDictType) {
  return getSystemApiClient().put<SysDictType>(`/system/dict/type/${id}`, data);
}

export async function deleteDictTypeApi(id: number) {
  return getSystemApiClient().delete(`/system/dict/type/${id}`);
}

// ------------------------------------------------------------------- 字典数据

export interface DictDataQuery extends PageQuery {
  /** 字典项标签，右模糊。 */
  dictLabel?: string;
  /** 字典项归属的类型，**精确匹配**（它是归属键，不是搜索词）。 */
  dictType?: string;
}

/**
 * 字典项分页列表，供字典管理页使用。
 *
 * 服务端按 `dictType` 精确过滤。此前后端没覆写 `buildListWrapper`，调用方只能传
 * `size: 500` 整批拉回来再在浏览器里筛——那是把分页接口当全量接口使，
 * 全库字典项超过 500 条就开始静默丢数据。别再那样写。
 */
export async function getDictDataListApi(params: DictDataQuery) {
  return getSystemApiClient().get<PageResult<SysDictData>>(
    '/system/dict/data',
    {
      params,
    },
  );
}

/**
 * 按字典类型取全部启用中的字典项，供业务表单的下拉框使用。仅要求登录。
 *
 * 这是框架里最早的「引用数据」端点，本约定的先例。形状比通用 `OptionItem` 宽
 * （字典项自带 `dictValue` 等语义），所以保持返回实体而不强行收敛。
 */
export async function getDictDataByTypeApi(dictType: string) {
  return getSystemApiClient().get<SysDictData[]>(
    `/system/dict/data/type/${dictType}`,
  );
}

export async function createDictDataApi(data: SysDictData) {
  return getSystemApiClient().post<SysDictData>('/system/dict/data', data);
}

export async function updateDictDataApi(id: number, data: SysDictData) {
  return getSystemApiClient().put<SysDictData>(`/system/dict/data/${id}`, data);
}

export async function deleteDictDataApi(id: number) {
  return getSystemApiClient().delete(`/system/dict/data/${id}`);
}

// ------------------------------------------------------------------- 参数配置

export interface ConfigQuery extends PageQuery {
  configKey?: string;
  configName?: string;
}

export async function getConfigListApi(params: ConfigQuery) {
  return getSystemApiClient().get<PageResult<SysConfig>>('/system/config', {
    params,
  });
}

export async function createConfigApi(data: SysConfig) {
  return getSystemApiClient().post<SysConfig>('/system/config', data);
}

export async function updateConfigApi(id: number, data: SysConfig) {
  return getSystemApiClient().put<SysConfig>(`/system/config/${id}`, data);
}

export async function deleteConfigApi(id: number) {
  return getSystemApiClient().delete(`/system/config/${id}`);
}

// ------------------------------------------------------------------- 操作日志

export interface OperLogQuery extends PageQuery {
  end?: string;
  module?: string;
  operatorName?: string;
  start?: string;
  status?: number;
}

export async function getOperLogListApi(params: OperLogQuery) {
  return getSystemApiClient().get<PageResult<SysOperLog>>('/system/oper-log', {
    params,
  });
}

export async function deleteOperLogApi(id: number) {
  return getSystemApiClient().delete(`/system/oper-log/${id}`);
}

/** 清空全部操作日志。 */
export async function cleanOperLogApi() {
  return getSystemApiClient().delete('/system/oper-log/clean');
}

// ------------------------------------------------------------------- 在线用户

/**
 * 在线会话列表（分页）。数据来自后端的 `TokenStore` 快照，由 `SysOnlineController`
 * 在应用层切片——没有对应数据库表，翻页会重复一次全量枚举，但这是低频管理页、
 * 在线会话数天然有界，可以接受。
 */
export interface OnlineQuery extends PageQuery {
  username?: string;
}

export async function getOnlineListApi(params: OnlineQuery) {
  return getSystemApiClient().get<PageResult<ActiveSession>>('/system/online', {
    params,
  });
}

/** 强制某用户下线，吊销其全部令牌，返回实际吊销的令牌数。 */
export async function forceLogoutApi(userId: number) {
  return getSystemApiClient().delete<number>(`/system/online/${userId}`);
}
