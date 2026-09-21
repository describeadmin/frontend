import type { GrantNode } from '../useGrantTree';

import { describe, expect, it } from 'vitest';

import { cascadeCheck, descendantIds, pathToNode } from '../useGrantTree';

/**
 * 典型的三层菜单树：系统管理(1) → 用户管理(2) → 新增(3)/编辑(4)/删除(5)。
 *
 * id 刻意写成**字符串**——链路上的 Long 被序列化为字符串（CLAUDE.md 4.8），
 * 这正是授权树拿到的真实形状。
 */
function menuTree(): GrantNode[] {
  return [
    {
      id: '1' as unknown as number,
      children: [
        {
          id: '2' as unknown as number,
          children: [
            { id: '3' as unknown as number },
            { id: '4' as unknown as number },
            { id: '5' as unknown as number },
          ],
        },
      ],
    },
  ];
}

/**
 * 部门授权树的形状：节点是 `OptionItem`，键叫 `value` 而不是 `id`。
 *
 * 两棵授权树的数据来源不同档（CLAUDE.md 4.11）：分配菜单要 `menuType`/`path`，
 * 走角色模块的 `grantable-menus`，节点是 `SysMenu`（`id`）；分配数据权限只要
 * id + 名称，走部门模块的 `/options`，节点是 `OptionItem`（`value`）。
 *
 * 这组用例是那条差异的守卫：`keyOf` 若只认 `id`，部门树的级联会**静默失效**
 * ——`pathToNode` 找不到节点就返回 `[]`，勾选看起来正常、子孙却没被带上。
 */
function deptTree(): GrantNode[] {
  return [
    {
      value: '10',
      children: [{ value: '20', children: [{ value: '30' }, { value: '31' }] }],
    },
  ];
}

describe('pathToNode', () => {
  it('returns the full path from root to the target, target included', () => {
    expect(pathToNode(menuTree(), '3').map((n) => n.id)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('returns a single-element path for a root node', () => {
    expect(pathToNode(menuTree(), '1').map((n) => n.id)).toEqual(['1']);
  });

  it('returns [] when the target is not in the tree', () => {
    expect(pathToNode(menuTree(), '999')).toEqual([]);
    expect(pathToNode([], '1')).toEqual([]);
  });

  // 这条是「授权树刻意不做 normalizeIds」的守卫：树里是字符串 id，调用方可能传 number。
  // 哪天有人"顺手补齐"了 normalizeIds 把树改成 number，这条仍应通过。
  it('matches regardless of id type (string tree, number lookup)', () => {
    expect(pathToNode(menuTree(), 3).map((n) => n.id)).toEqual(['1', '2', '3']);
    expect(pathToNode(menuTree(), '3').map((n) => n.id)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });
});

describe('pathToNode (value-keyed nodes)', () => {
  it('finds nodes keyed by value, not just id', () => {
    expect(pathToNode(deptTree(), '30').map((n) => n.value)).toEqual([
      '10',
      '20',
      '30',
    ]);
  });
});

describe('descendantIds', () => {
  it('collects every descendant, excluding the node itself', () => {
    const root = menuTree()[0] as GrantNode;
    expect(descendantIds(root)).toEqual(['2', '3', '4', '5']);
  });

  it('returns [] for a leaf', () => {
    const leaf = pathToNode(menuTree(), '3').at(-1) as GrantNode;
    expect(descendantIds(leaf)).toEqual([]);
  });
});

/**
 * 最小的 ElTree 替身：只实现 `check-strictly` 下 `getNode`/`setChecked(key, v, false)`
 * 的语义——精确只改这一个节点，不级联。
 */
function fakeTree(checked: Set<string> = new Set()) {
  return {
    checked,
    getNode: (key: unknown) => ({ checked: checked.has(String(key)) }),
    setChecked: (key: unknown, value: boolean) => {
      if (value) {
        checked.add(String(key));
      } else {
        checked.delete(String(key));
      }
    },
  };
}

describe('cascadeCheck', () => {
  it('checking a node pulls in its ancestors and all descendants', () => {
    const tree = menuTree();
    const el = fakeTree(new Set(['2']));
    cascadeCheck(el, tree, '2');
    expect([...el.checked].toSorted()).toEqual(['1', '2', '3', '4', '5']);
  });

  it('unchecking a node takes its descendants but leaves ancestors alone', () => {
    const tree = menuTree();
    const el = fakeTree(new Set(['1', '3', '4', '5']));
    cascadeCheck(el, tree, '2');
    expect([...el.checked].toSorted()).toEqual(['1']);
  });

  it('checking a leaf pulls in the whole ancestor chain', () => {
    const tree = menuTree();
    const el = fakeTree(new Set(['3']));
    cascadeCheck(el, tree, '3');
    expect([...el.checked].toSorted()).toEqual(['1', '2', '3']);
  });

  /**
   * 这条就是问题本身：勾上「用户管理」，再把三个按钮逐个取消，
   * 必须剩下「系统管理 + 用户管理」——也就是**只给列表权限**。
   *
   * 旧的父子联动模式下，取消最后一个按钮会连带把「用户管理」也弹回未勾，
   * 于是这个授权状态根本无法表达。
   */
  it('regression: unchecking every button keeps the parent menu granted', () => {
    const tree = menuTree();
    const el = fakeTree();

    el.setChecked('2', true);
    cascadeCheck(el, tree, '2');
    expect([...el.checked].toSorted()).toEqual(['1', '2', '3', '4', '5']);

    for (const buttonId of ['3', '4', '5']) {
      el.setChecked(buttonId, false);
      cascadeCheck(el, tree, buttonId);
    }

    expect([...el.checked].toSorted()).toEqual(['1', '2']);
  });

  /**
   * 部门授权树走 `value` 键，级联行为必须与菜单树逐条一致。
   *
   * 注意这里只验证**勾选联动**；部门 id 的祖先闭包是另一回事，后端
   * `assignDataScopeDepts` 刻意不做——菜单 id 是挂载点，部门 id 是
   * `dept_id IN (...)` 的行过滤值，给后者补祖先是越权而不是修复。
   */
  it('cascades the same way for value-keyed (dept) nodes', () => {
    const tree = deptTree();
    const el = fakeTree(new Set(['20']));
    cascadeCheck(el, tree, '20');
    expect([...el.checked].toSorted()).toEqual(['10', '20', '30', '31']);

    el.setChecked('20', false);
    cascadeCheck(el, tree, '20');
    expect([...el.checked].toSorted()).toEqual(['10']);
  });

  it('does nothing when the tree ref is missing or the node is unknown', () => {
    const tree = menuTree();
    const el = fakeTree(new Set(['1']));
    expect(() => cascadeCheck(null, tree, '1')).not.toThrow();
    cascadeCheck(el, tree, '999');
    expect([...el.checked]).toEqual(['1']);
  });
});
