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

export async function getUserListApi(params: PageQuery) {
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

export async function getRoleListApi(params: PageQuery) {
  return getSystemApiClient().get<PageResult<SysRole>>('/system/role', {
    params,
  });
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

/** 全量菜单树（含 BUTTON 权限点），供菜单管理与角色授权使用。 */
export async function getMenuTreeApi() {
  return getSystemApiClient().get<SysMenu[]>('/system/menu/tree');
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

export async function getDeptTreeApi() {
  return getSystemApiClient().get<SysDept[]>('/system/dept/tree');
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

export async function getDictTypeListApi(params: PageQuery) {
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

/**
 * 未按 `dictType` 做服务端过滤——后端 `SysDictDataController` 未覆写
 * `buildListWrapper`。调用方传大 `size` 整批拉取后自行按 `dictType` 客户端过滤。
 */
export async function getDictDataListApi(params: PageQuery) {
  return getSystemApiClient().get<PageResult<SysDictData>>(
    '/system/dict/data',
    {
      params,
    },
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

export async function getConfigListApi(params: PageQuery) {
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
 * 在线会话列表。数据直接来自 `TokenStore`，没有分页——默认的
 * `InMemoryTokenStore` 只持有当前实例的会话，规模天然有限。
 */
export async function getOnlineListApi() {
  return getSystemApiClient().get<ActiveSession[]>('/system/online');
}

/** 强制某用户下线，吊销其全部令牌，返回实际吊销的令牌数。 */
export async function forceLogoutApi(userId: number) {
  return getSystemApiClient().delete<number>(`/system/online/${userId}`);
}
