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
  PageQuery,
  PageResult,
  SysDept,
  SysMenu,
  SysRole,
  SysUser,
} from './types';

import { requestClient } from '#/api/request';

export * from './types';

// --------------------------------------------------------------------- 用户

export async function getUserListApi(params: PageQuery) {
  return requestClient.get<PageResult<SysUser>>('/system/user', { params });
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
  return requestClient.post<SysUser>('/system/user/with-password', data);
}

export async function updateUserApi(id: number, data: SysUser) {
  return requestClient.put<SysUser>(`/system/user/${id}`, data);
}

export async function deleteUserApi(id: number) {
  return requestClient.delete(`/system/user/${id}`);
}

export async function resetUserPasswordApi(id: number, password: string) {
  return requestClient.put(`/system/user/${id}/password`, { password });
}

export async function getUserRolesApi(id: number) {
  return requestClient.get<number[]>(`/system/user/${id}/roles`);
}

export async function assignUserRolesApi(id: number, roleIds: number[]) {
  return requestClient.put(`/system/user/${id}/roles`, roleIds);
}

// --------------------------------------------------------------------- 角色

export async function getRoleListApi(params: PageQuery) {
  return requestClient.get<PageResult<SysRole>>('/system/role', { params });
}

export async function createRoleApi(data: SysRole) {
  return requestClient.post<SysRole>('/system/role', data);
}

export async function updateRoleApi(id: number, data: SysRole) {
  return requestClient.put<SysRole>(`/system/role/${id}`, data);
}

export async function deleteRoleApi(id: number) {
  return requestClient.delete(`/system/role/${id}`);
}

export async function getRoleMenusApi(id: number) {
  return requestClient.get<number[]>(`/system/role/${id}/menus`);
}

export async function assignRoleMenusApi(id: number, menuIds: number[]) {
  return requestClient.put(`/system/role/${id}/menus`, menuIds);
}

// --------------------------------------------------------------------- 菜单

/** 全量菜单树（含 BUTTON 权限点），供菜单管理与角色授权使用。 */
export async function getMenuTreeApi() {
  return requestClient.get<SysMenu[]>('/system/menu/tree');
}

export async function createMenuApi(data: SysMenu) {
  return requestClient.post<SysMenu>('/system/menu', data);
}

export async function updateMenuApi(id: number, data: SysMenu) {
  return requestClient.put<SysMenu>(`/system/menu/${id}`, data);
}

export async function deleteMenuApi(id: number) {
  return requestClient.delete(`/system/menu/${id}`);
}

// --------------------------------------------------------------------- 部门

export async function getDeptTreeApi() {
  return requestClient.get<SysDept[]>('/system/dept/tree');
}

export async function createDeptApi(data: SysDept) {
  return requestClient.post<SysDept>('/system/dept', data);
}

export async function updateDeptApi(id: number, data: SysDept) {
  return requestClient.put<SysDept>(`/system/dept/${id}`, data);
}

export async function deleteDeptApi(id: number) {
  return requestClient.delete(`/system/dept/${id}`);
}
