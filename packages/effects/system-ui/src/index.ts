import type { ComponentRecordType } from '@describeadmin/types';

export * from './api';
export { default as AvatarPicker } from './components/AvatarPicker.vue';
export {
  loadMessageCategoryLabels,
  MESSAGE_CATEGORY_DICT,
  MESSAGE_POLL_INTERVAL,
  messageCategoryLabel,
  type MessageNotificationItem,
  notifyInboxChanged,
  openMessageLink,
  useMessageInbox,
} from './composables/useMessageInbox';
export { AVATAR_SIZE, avatarUrl, compressAvatar } from './utils/avatar';
export { relativeTime } from './utils/relative-time';

/**
 * 消息中心页（懒加载）。所有登录用户都有、不逐角色授权，所以不进 `sys_menu`、
 * 也不在下面的 `systemPageMap` 里——由应用外壳挂到本地静态路由 `Root.children`：
 *
 * ```ts
 * { name: 'MessageCenter', path: 'messages', component: MessageCenterPage,
 *   meta: { hideInMenu: true, title: '消息中心' } }
 * ```
 *
 * 不要把它列进 `coreRouteNames` 白名单，原因见 CLAUDE.md 4.5.1 末尾。
 */
export const MessageCenterPage = () => import('./views/message/index.vue');

/**
 * 系统管理页面组件的路由 key → 懒加载组件 映射。
 *
 * key 必须与 framework-system-starter 的 seed-rbac.sql（以及 codegen 产出的
 * menu-*.sql）里 `sys_menu.component` 字段规范化后的结果精确一致——`component`
 * 填的是不带 `.vue` 的相对路径（如 `system/dept/index`），经
 * `generateRoutesByBackend` 的 normalizeViewPath 规范化（去掉 `./`/`../` 前缀、
 * 补前导 `/`、剥掉前导 `/views`）后即为下面这些 key，`.vue` 后缀不受该函数影响。
 *
 * 消费方（应用外壳）把这份 map 展开合并进自己的 `pageMap`——`systemPageMap` 必须
 * 展开在前，让业务方本地同名页面（如自定义了 `views/system/user/index.vue`）
 * 覆盖框架默认实现，反过来会被静默吃掉且不会报错：
 *
 * ```ts
 * const pageMap: ComponentRecordType = {
 *   ...systemPageMap,
 *   ...import.meta.glob('../views/**\/*.vue'),
 * };
 * ```
 */
export const systemPageMap: ComponentRecordType = {
  '/system/config/index.vue': () => import('./views/config/index.vue'),
  '/system/dept/index.vue': () => import('./views/dept/index.vue'),
  '/system/dict/index.vue': () => import('./views/dict/index.vue'),
  '/system/menu/index.vue': () => import('./views/menu/index.vue'),
  '/system/online/index.vue': () => import('./views/online/index.vue'),
  '/system/oper-log/index.vue': () => import('./views/oper-log/index.vue'),
  '/system/role/index.vue': () => import('./views/role/index.vue'),
  '/system/user/index.vue': () => import('./views/user/index.vue'),
};
