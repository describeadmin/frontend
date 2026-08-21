/**
 * 系统管理的后端契约。
 *
 * 这些结构一一对应 framework-system-starter 的实体，**由框架提供、业务方不实现**——
 * 框架修了 RBAC 的问题，业务方升个版本就拿到了（develop_plan.md 目标 #5）。
 * 因此这个文件应当跟着框架的 `api/` 包走，不要按页面需要随手加字段。
 */

/** `BaseEntity` 的审计字段，所有系统实体共有。 */
export interface AuditFields {
  createBy?: null | number;
  createTime?: null | string;
  id?: number;
  updateBy?: null | number;
  updateTime?: null | string;
  version?: null | number;
}

/** 后端 `PageResult<T>`。刻意不直接用 MyBatis-Plus 的 IPage，避免契约与 ORM 绑死。 */
export interface PageResult<T> {
  current: number;
  pages: number;
  records: T[];
  size: number;
  total: number;
}

export interface PageQuery {
  current?: number;
  size?: number;
}

export interface SysUser extends AuditFields {
  deptId?: null | number;
  /** 非持久化字段，由后端联表带出，不要提交回去。 */
  deptName?: null | string;
  nickname?: null | string;
  /** 1 启用 / 0 停用。用 0/1 而非 boolean —— MySQL 中 boolean 实为 TINYINT(1) 别名。 */
  status?: null | number;
  username?: string;
}

export interface SysRole extends AuditFields {
  roleCode?: string;
  roleName?: string;
  sort?: null | number;
}

export type MenuType = 'BUTTON' | 'DIR' | 'MENU';

export interface SysMenu extends AuditFields {
  children?: SysMenu[];
  component?: null | string;
  icon?: null | string;
  menuName?: string;
  menuType?: MenuType;
  parentId?: null | number;
  path?: null | string;
  permCode?: null | string;
  sort?: null | number;
  visible?: null | number;
}

export interface SysDept extends AuditFields {
  children?: SysDept[];
  deptName?: string;
  leader?: null | string;
  parentId?: null | number;
  phone?: null | string;
  sort?: null | number;
  status?: null | number;
}
