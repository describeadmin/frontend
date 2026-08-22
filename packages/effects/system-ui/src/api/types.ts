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
  /** 可空，非空时后端在应用层保证唯一；是否存在对应的登录方式取决于有没有装配插件。 */
  email?: null | string;
  /** 可空，非空时后端在应用层保证唯一，理由同 {@link email}。 */
  mobile?: null | string;
  nickname?: null | string;
  /** 1 启用 / 0 停用。用 0/1 而非 boolean —— MySQL 中 boolean 实为 TINYINT(1) 别名。 */
  status?: null | number;
  username?: string;
}

export interface SysRole extends AuditFields {
  /**
   * 数据权限范围，取值见 `DataScopeType`：1 全部 / 2 自定义部门 / 3 本部门 /
   * 4 本部门及以下 / 5 仅本人。
   */
  dataScope?: null | number;
  /**
   * 该角色登录后的默认首页路径，取值须为 `SysMenu.path` 中真实存在的路径。
   * 为空表示不覆盖，使用前端全局 `preferences.app.defaultHomePath`。
   */
  homePath?: null | string;
  roleCode?: string;
  roleName?: string;
  sort?: null | number;
}

/** 对应后端 `DataScopeType` 枚举，供角色表单的数据范围下拉复用。 */
export const DATA_SCOPE_OPTIONS = [
  { label: '全部数据', value: 1 },
  { label: '自定义部门', value: 2 },
  { label: '仅本部门', value: 3 },
  { label: '本部门及以下', value: 4 },
  { label: '仅本人', value: 5 },
] as const;

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

export interface SysDictType extends AuditFields {
  dictName?: string;
  dictType?: string;
  /** 1 启用 / 0 停用。 */
  status?: null | number;
}

/** 通过 {@link SysDictType.dictType} 关联到所属字典类型。 */
export interface SysDictData extends AuditFields {
  dictLabel?: string;
  dictType?: string;
  dictValue?: string;
  sort?: null | number;
  status?: null | number;
}

export interface SysConfig extends AuditFields {
  configKey?: string;
  /** 是否内置：Y/N，仅作展示用，非必填。 */
  configType?: null | string;
  configValue?: string;
  configName?: string;
}

/**
 * 操作日志。刻意不继承 {@link AuditFields}——后端 `SysOperLog` 不继承
 * `BaseEntity`（只追加、不给用户改的审计表，没有逻辑删除/乐观锁语义）。
 */
export interface SysOperLog {
  costTime?: null | number;
  createTime?: null | string;
  description?: string;
  errorMsg?: null | string;
  httpMethod?: null | string;
  id?: number;
  module?: string;
  operatorId?: null | number;
  operatorIp?: null | string;
  operatorName?: null | string;
  requestParam?: null | string;
  requestUrl?: null | string;
  /** 1 成功 / 0 失败。 */
  status?: number;
}

/**
 * 在线会话的只读快照。刻意不含令牌本身，见后端 `ActiveSession` 类注释。
 * 会话粒度而非用户粒度：同一用户多设备登录会出现多条。
 */
export interface ActiveSession {
  authType: string;
  expiresAt: string;
  issuedAt: string;
  nickname: string;
  userId: number;
  username: string;
}
