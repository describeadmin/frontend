/**
 * 角色授权树（分配菜单 / 分配数据权限）的勾选联动。
 *
 * ## 为什么不用 ElTree 默认的父子联动
 *
 * 默认（非 `check-strictly`）模式下，**父节点的勾选态由子节点推导**：子节点全不勾，
 * 父节点必然是未勾。而本框架的菜单模型里父 `MENU` 节点自己就带权限点
 * （`system:user:list`），子 `BUTTON` 节点带 add/edit/remove——于是
 * 「只给列表权限」= 父勾、子全不勾，这个状态在联动模式下**根本无法表达**，
 * 且界面上看不出是做不到（勾上去、松手就弹回来，像是点歪了）。
 *
 * 所以两棵授权树都用 `check-strictly` + 本文件的手写单向级联。
 *
 * ## 不变式
 *
 * **勾选集合在任何时刻对祖先闭包**：`checked(x) ⟹ checked(parent(x))`。
 * 「父勾了、子不勾」合法，那正是「只给列表权限」；「子勾了、父没勾」不合法。
 *
 * 后端 `SysRoleService.assignMenus` 会在写入时把集合闭包到祖先。UI 若允许出现
 * 非闭包状态，落库结果就和管理员看到的不是一个东西——**下次打开弹窗他刚做的取消
 * 已经被改回来了**，而接口返回的数据"明明是对的"。
 *
 * ## 与 dept/menu 页的 `normalizeIds()` 的区别（不要"顺手补齐"）
 *
 * `dept/index.vue` 与 `menu/index.vue` 里那个把字符串 id 转 number 的
 * `normalizeIds()` 是给 **ElTreeSelect 的 v-model** 用的：那里是 `value === node.key`
 * 的严格相等，字符串 `'0'` 配不上合成根节点的数字 `0`。
 *
 * ElTree 的**勾选**链路不是这样：`nodesMap` 是普通 JS 对象（属性名强制转字符串），
 * `setCheckedKeys` 内部显式 `node.data[key].toString()` 后再比对。本文件的两个函数
 * 也一律按字符串比对、回填时原样使用节点上的 `id`，三方类型天然一致。
 * **授权树不需要 normalizeIds**。
 */

/**
 * 授权树节点：只要求「一个键 + children」。
 *
 * 两棵树的节点形状不同，是因为它们的数据来源不同档：
 * - 分配菜单用 `SysMenu`（`id`），走角色模块的 `grantable-menus`——授权树要
 *   `menuType`/`path`，通用选项形状带不了；
 * - 分配数据权限用 `OptionItem`（`value`），走部门模块的 `/options`——只要 id + 名称。
 *
 * 见 CLAUDE.md 4.11。因此这里认 `id` 或 `value` 两种键，取其一即可。
 */
export interface GrantNode {
  children?: GrantNode[];
  id?: number;
  value?: string;
}

/**
 * 节点的键。`id` 优先，没有则用 `value`。
 *
 * 必须与 ElTree 的 `node-key` 逐字对应（菜单树是 `id`、部门树是 `value`）——
 * 对不上的症状是**静默的**：`pathToNode` 找不到节点直接返回 `[]`，级联什么也不做，
 * 勾选看起来正常、子孙却没被带上，只有提交后重开弹窗才发现少了。
 */
function keyOf(node: GrantNode): unknown {
  return node.id ?? node.value;
}

/**
 * 从根到 `targetId` 的完整路径（**含 target 自身**），找不到返回 `[]`。
 *
 * id 一律按字符串比对——链路上的 Long 被序列化为字符串（见 CLAUDE.md 4.8），
 * 而调用方传来的可能是任一侧的原值。
 */
export function pathToNode(tree: GrantNode[], targetId: unknown): GrantNode[] {
  const target = String(targetId);
  const walk = (nodes: GrantNode[], trail: GrantNode[]): GrantNode[] => {
    for (const node of nodes) {
      const next = [...trail, node];
      const key = keyOf(node);
      if (key !== undefined && String(key) === target) {
        return next;
      }
      const found = walk(node.children ?? [], next);
      if (found.length > 0) {
        return found;
      }
    }
    return [];
  };
  return walk(tree, []);
}

/** `node` 的全部子孙 id（**不含自身**），深度优先。 */
export function descendantIds(node: GrantNode): unknown[] {
  const ids: unknown[] = [];
  const walk = (nodes: GrantNode[]) => {
    for (const child of nodes) {
      const key = keyOf(child);
      if (key !== undefined) {
        ids.push(key);
      }
      walk(child.children ?? []);
    }
  };
  walk(node.children ?? []);
  return ids;
}

/** `ElTree` 实例上本模块要用到的部分，避免把整个组件类型拖进来。 */
interface CheckableTree {
  getNode: (key: unknown) => null | undefined | { checked?: boolean };
  setChecked: (key: unknown, checked: boolean, deep: boolean) => void;
}

/**
 * `check-strictly` 下的单向级联：向下同步，向上只加不减。
 *
 * - 勾选：补齐全部**祖先**（维持不变式）+ 带上全部**子孙**（便捷，行为与旧的联动模式一致）
 * - 取消：带走全部**子孙**；**祖先一律不动** —— 这正是「父被授权、子全不授权」
 *   得以表达的地方，也就是「只给列表权限」
 *
 * 取消时必须带走子孙：否则留下「子勾着、父没勾」的非闭包状态，后端写入时会把祖先补回来，
 * 这次取消等于没做。
 *
 * 方向不从 `check` 事件的 payload 判断：该事件在 `nextTick` 里发出、payload 是那一刻的
 * 快照，而这里还要继续改勾选态。直接读节点自身的 `checked` 更可靠。
 *
 * `setChecked` 的第三个参数固定传 `false`：`check-strictly` 下它精确只改这一个节点，
 * 既不碰祖先也不碰子孙，于是完全绕开 ElTree 内部 `handleDescendants` 的那条边界
 * （存在 disabled 且未勾选的叶子时，会把父节点反向改成半选）。
 */
export function cascadeCheck(
  treeRef: CheckableTree | null | undefined,
  tree: GrantNode[],
  nodeId: unknown,
): void {
  if (!treeRef) {
    return;
  }
  const path = pathToNode(tree, nodeId);
  const self = path.at(-1);
  if (!self) {
    return;
  }
  const checked = !!treeRef.getNode(nodeId)?.checked;
  if (checked) {
    for (const ancestor of path.slice(0, -1)) {
      treeRef.setChecked(keyOf(ancestor), true, false);
    }
    for (const id of descendantIds(self)) {
      treeRef.setChecked(id, true, false);
    }
  } else {
    for (const id of descendantIds(self)) {
      treeRef.setChecked(id, false, false);
    }
  }
}

/**
 * 批量改勾选（「分配菜单」里的检索结果全选 / 取消全选）。
 *
 * **起点是树当前态，不是调用方记着的那个 id 数组**：先 `setChecked` 把节点推到目标态，
 * 再交给 `cascadeCheck` 按「读节点自身 checked」的方式补祖先 / 带子孙。拿一份缓存数组
 * 重算的写法会在用户手工点过几下之后就跟树不同步——而那份数组看起来"明明是对的"。
 *
 * 不跳过「已经在目标态」的节点：全选时那条路径是**补齐命中节点的整枝**（管理员明确点了
 * 全选，就是要把这一片都授出去，包括他之前特意留成只读的按钮）；取消时 `cascadeCheck`
 * 对已经取消的子节点是幂等的，省下的那点遍历不值得多一个分支。
 *
 * 树里查不到的 id（检索过滤后不可见、或菜单已被删）直接跳过：批量操作的影响面不能
 * 因为找不到节点而变得不可预期。
 */
export function applyCheckedChanges(
  treeRef: CheckableTree | null | undefined,
  tree: GrantNode[],
  ids: Iterable<unknown>,
  checked: boolean,
): void {
  if (!treeRef) {
    return;
  }
  for (const id of ids) {
    if (!treeRef.getNode(id)) {
      continue;
    }
    treeRef.setChecked(id, checked, false);
    cascadeCheck(treeRef, tree, id);
  }
}
