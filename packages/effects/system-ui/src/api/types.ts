/**
 * 系统管理的后端契约。
 *
 * 这些结构一一对应 framework-system-starter 的实体，**由框架提供、业务方不实现**——
 * 框架修了 RBAC 的问题，业务方升个版本就拿到了。
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

/**
 * 后端 `OptionItem`：跨模块引用数据的标准形状，供下拉框与树选择器使用。
 *
 * 用它取代「调别的模块的分页列表接口填下拉框」，一次解掉两个问题：
 * - **分页截断**：`?current=1&size=200` 是把分页接口当全量接口使，超出就静默丢数据，
 *   且调大参数也没用（后端 `PageQuery.MAX_SIZE` 在入口夹紧）。选项接口不分页。
 * - **授权不闭环**：`/options` 只要求登录、不挂权限点，因此「只授用户管理」的角色
 *   也能填出角色与部门下拉，而侧边栏不会多出别的模块的入口。
 *
 * 约定与分档见 CLAUDE.md 4.11。
 *
 * `value` 是字符串而不是数字：后端把所有 `Long` 序列化为字符串（雪花 ID 有 19 位，
 * 超过 JS 的 `Number.MAX_SAFE_INTEGER`，用数字会被 `JSON.parse` 静默舍入末几位）。
 * 因此绑定它的 `node-key`、合成的顶层节点也要用字符串（写 `'0'` 而不是 `0`）——
 * ElTreeSelect 的 v-model 按严格相等匹配，类型不一致的症状是"选了没反应"。
 *
 * 平铺与树是同一个形状：`children` 只在树形数据里出现。
 */
export interface OptionItem {
  /** 仅树形数据下发；平铺选项没有这个字段。 */
  children?: OptionItem[];
  /** 停用项：仍然下发（否则编辑时回显为空），但不可选。 */
  disabled?: boolean;
  label: string;
  value: string;
}

export interface SysUser extends AuditFields {
  /**
   * 头像的对象键，不是 URL——用 `avatarUrl()` 转成地址。只读：后端是 `updateStrategy = NEVER` 列，
   * 通用编辑端点提交了也不会生效，改头像走 {@link uploadUserAvatarApi}。
   */
  avatar?: null | string;
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
  /** 侧边栏高亮路径，隐藏页面填其所属菜单的 path。 */
  activePath?: null | string;
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
  /**
   * 是否内置：Y/N。只读——只由种子数据设置，前端表单不提供录入项，后端 save 也会
   * 强制清空调用方传入的值；内置参数（Y）不允许删除，由后端 SysConfigService 拒绝。
   */
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
  /**
   * 是否就是发起本次查询的会话（即"我正在用的这个登录"）。由后端比对请求令牌得出，
   * 同一账号在别的浏览器 / 重复登录留下的会话为 false。
   */
  current: boolean;
  /** 登录时的设备描述，如 `Chrome · Windows`；识别不出为 null。 */
  device: null | string;
  expiresAt: string;
  /** 登录时的客户端 IP；实现未记录来源时为 null。 */
  ip: null | string;
  issuedAt: string;
  nickname: string;
  /**
   * 会话标识：令牌的单向摘要，不是令牌本身。业务方自定义的 `TokenStore` 没提供时为 null，
   * 此时也不会有任何一条被标为 `current`。
   */
  sessionId: null | string;
  userId: number;
  username: string;
}

/**
 * 站内信。刻意不继承 {@link AuditFields}——后端 `SysMessage` 不继承 `BaseEntity`
 * （系统写入、收件人只读 / 标已读 / 删除）。
 *
 * `id` 声明成字符串：后端把 `Long` 一律序列化为字符串（CLAUDE.md 4.8），回传给
 * 标已读、删除接口时原样拼进路径即可，不要转成数字。
 */
export interface SysMessage {
  /** 业务自定的分类编码，如 `workorder.approval`；中文名查字典 `sys_message_category`。 */
  category: string;
  /** 纯文本，渲染时一律插值，不要用 `v-html`。 */
  content: null | string;
  createTime: string;
  id: string;
  /** 站内路由路径，可带 query；后端已拒绝外链。 */
  link: null | string;
  /** 已读时间，null 为未读。 */
  readTime: null | string;
  /** 发送人头像的对象键，用 `avatarUrl()` 拼地址；系统消息为 null。 */
  senderAvatar?: null | string;
  senderId: null | string;
  senderName?: null | string;
  title: string;
}

/** 顶栏铃铛轮询的响应：未读数 + 最近几条（含已读）。 */
export interface MessageInbox {
  latest: SysMessage[];
  unreadCount: number;
}
