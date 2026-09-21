import { useAccess } from './use-access';

/**
 * 按「<模块>:<对象>」前缀判断按钮级权限（约定见 CLAUDE.md 4.5 / 4.5.3）。
 *
 * `prefix` 必须与三处口径完全一致，否则按钮会全部不显示，且错误信息里没有任何东西
 * 指向前缀写错了：
 *
 * 1. 后端 `BaseController.permPrefix()` 的推导结果（`/api/system/user` → `system:user`）
 * 2. `seed-rbac.sql` / codegen 的 `menu-*.sql` 里登记的 `perm_code`
 * 3. 这里传的字符串
 *
 * **前端显隐只是体验，不是授权。** 真正的强制校验在后端的 `@PreAuthorize` 与
 * `BaseController.requirePermission()`，不能因为按钮藏了就认为接口安全。
 *
 * @example
 * ```ts
 * const { can, canAny } = usePermission('system:user');
 * ```
 * ```html
 * <ElButton v-if="can('add')">新增</ElButton>
 * <ElTableColumn v-if="canAny('edit', 'remove')" label="操作" />
 * ```
 *
 * ---
 *
 * **为什么是组合式函数 + `v-if`，而不是现成的 `v-access:code` 指令**——指令
 * （`./directive.ts`）只有 `mounted` 钩子，且用 `el.remove()` 把节点从 Vue 的虚拟 DOM
 * 底下物理摘掉：权限码刷新后（`fetchUserInfo()` 每次刷新页面都回源 `/auth/me`）不会重算，
 * 与 `ElTooltip`、兄弟 `v-if` 混用时 patch 行为也不可控；而且「整个操作列一个按钮都没权限
 * 时不渲染该列」这种判断它根本表达不了。
 *
 * `can()` 在模板里调用时读的是响应式的 `accessStore.accessCodes`，组件的渲染副作用
 * 自然追踪到它，权限码变化即重算。**不要把 `can('add')` 的结果存进普通 const** ——
 * 那一刻就求值完了，之后再不更新。要缓存请用 `computed`。
 */
export function usePermission(prefix: string) {
  const { hasAccessByCodes } = useAccess();

  /** 是否拥有 `<prefix>:<action>` 这个权限点。 */
  function can(action: string): boolean {
    return hasAccessByCodes([`${prefix}:${action}`]);
  }

  /** 任一命中即为 true。用于「整块/整列是否渲染」。 */
  function canAny(...actions: string[]): boolean {
    return actions.some((action) => can(action));
  }

  return { can, canAny };
}
