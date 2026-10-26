import type { FilterableMenuNode } from '../useMenuFilter';

import { describe, expect, it } from 'vitest';

import {
  collectMenuIds,
  filterMenuTree,
  matchesKeyword,
  splitByKeyword,
  summarizeChecked,
} from '../useMenuFilter';

/**
 * 一棵接近真实 seed 的菜单树。
 *
 * id 写成**字符串**——链路上的 Long 被序列化为字符串（CLAUDE.md 4.8），
 * 授权树拿到的就是这种形状，过滤函数也一律按字符串比对。
 */
function menuTree(): FilterableMenuNode[] {
  return [
    {
      children: [
        {
          children: [
            {
              id: '3' as unknown as number,
              menuName: '新增',
              menuType: 'BUTTON',
              permCode: 'system:user:add',
            },
            {
              id: '4' as unknown as number,
              menuName: '编辑',
              menuType: 'BUTTON',
              permCode: 'system:user:edit',
            },
            {
              id: '5' as unknown as number,
              menuName: '分配角色',
              menuType: 'BUTTON',
              permCode: 'system:user:assign-role',
            },
          ],
          id: '2' as unknown as number,
          menuName: '用户管理',
          menuType: 'MENU',
          path: '/system/user',
          permCode: 'system:user:list',
        },
        {
          children: [
            {
              id: '7' as unknown as number,
              menuName: '分配菜单',
              menuType: 'BUTTON',
              permCode: 'system:role:assign-menu',
            },
            {
              id: '8' as unknown as number,
              menuName: '用户详情',
              menuType: 'MENU',
              path: '/system/user/detail',
              visible: 0,
            },
          ],
          id: '6' as unknown as number,
          menuName: '角色管理',
          menuType: 'MENU',
          path: '/system/role',
          permCode: 'system:role:list',
        },
      ],
      id: '1' as unknown as number,
      menuName: '系统管理',
      menuType: 'DIR',
    },
  ];
}

/** 树里留下的节点 id，深度优先，便于整棵比对。 */
function idsOf(nodes: FilterableMenuNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: FilterableMenuNode[]) => {
    for (const node of list) {
      ids.push(String(node.id));
      walk(node.children ?? []);
    }
  };
  walk(nodes);
  return ids;
}

describe('matchesKeyword', () => {
  const node = menuTree()[0]?.children?.[0] as FilterableMenuNode;

  it('matches name, permission code and path', () => {
    expect(matchesKeyword(node, '用户')).toBe(true);
    expect(matchesKeyword(node, 'system:user:list')).toBe(true);
    expect(matchesKeyword(node, '/system/user')).toBe(true);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(matchesKeyword(node, '  SYSTEM:USER:LIST  ')).toBe(true);
  });

  // 空关键字不能把树筛空：调用方（弹窗打开、清空输入框）都指望此时"什么都在"。
  it('treats a blank keyword as "everything matches"', () => {
    expect(matchesKeyword(node, '')).toBe(true);
    expect(matchesKeyword(node, '   ')).toBe(true);
  });

  it('returns false when nothing matches', () => {
    expect(matchesKeyword(node, '不存在的东西')).toBe(false);
  });
});

describe('filterMenuTree', () => {
  it('keeps the whole tree and treats every node as matched when the keyword is blank', () => {
    const result = filterMenuTree(menuTree(), '  ');
    expect(idsOf(result.tree)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ]);
    // 空关键字下「检索结果」就是全量，否则「全选」按钮在没输关键字时无事可做
    expect([...result.matchedIds].toSorted()).toEqual(
      [...collectMenuIds(menuTree())].toSorted(),
    );
    expect(result.empty).toBe(false);
  });

  /**
   * 搜到页面就该看见它下面的按钮：授权时的动作几乎总是"勾页面 + 勾几个按钮"，
   * 只显示命中节点本身等于搜出来一个点不动的节点。
   */
  it('keeps the matched node with its whole subtree', () => {
    const result = filterMenuTree(menuTree(), '用户管理');
    expect(idsOf(result.tree)).toEqual(['1', '2', '3', '4', '5']);
    expect([...result.matchedIds].toSorted()).toEqual(['2', '3', '4', '5']);
    expect(result.empty).toBe(false);
  });

  /**
   * 反向的一条：只命中按钮时，祖先必须留下当挂载点，兄弟节点剪掉，
   * 并且**祖先不进 matchedIds**——否则一次「全选结果」会顺手把整个系统管理的子树授出去。
   */
  it('keeps the ancestor chain as context but does not count it as matched', () => {
    const result = filterMenuTree(menuTree(), '分配角色');
    expect(idsOf(result.tree)).toEqual(['1', '2', '5']);
    expect([...result.matchedIds]).toEqual(['5']);
    expect([...result.visibleIds].toSorted()).toEqual(['1', '2', '5']);
  });

  it('matches on permission code and on path', () => {
    expect(
      idsOf(filterMenuTree(menuTree(), 'system:role:assign-menu').tree),
    ).toEqual(['1', '6', '7']);
    expect(
      idsOf(filterMenuTree(menuTree(), '/system/user/detail').tree),
    ).toEqual(['1', '6', '8']);
  });

  // 隐藏页（visible = 0）不进侧边栏，但必须授权才有路由，检索当然得能搜到它。
  it('finds hidden pages', () => {
    const result = filterMenuTree(menuTree(), '用户详情');
    expect([...result.matchedIds]).toEqual(['8']);
  });

  it('reports empty when nothing matches', () => {
    const result = filterMenuTree(menuTree(), '这个菜单不存在');
    expect(result.tree).toEqual([]);
    expect(result.empty).toBe(true);
    expect(result.matchedIds.size).toBe(0);
  });
});

describe('summarizeChecked', () => {
  it('counts by menu type and accepts mixed id types', () => {
    const summary = summarizeChecked(menuTree(), ['1', 2, '3']);
    expect(summary).toEqual({ button: 1, dir: 1, menu: 1, total: 3 });
  });

  it('ignores ids that are not in the tree (deleted menus still in sys_role_menu)', () => {
    expect(summarizeChecked(menuTree(), ['1', '999'])).toEqual({
      button: 0,
      dir: 1,
      menu: 0,
      total: 1,
    });
  });

  it('returns zeros for an empty selection', () => {
    expect(summarizeChecked(menuTree(), [])).toEqual({
      button: 0,
      dir: 0,
      menu: 0,
      total: 0,
    });
  });
});

describe('splitByKeyword', () => {
  it('splits into hit / miss parts', () => {
    expect(splitByKeyword('用户管理', '用户')).toEqual([
      { hit: true, text: '用户' },
      { hit: false, text: '管理' },
    ]);
  });

  it('handles multiple occurrences and keeps the original casing', () => {
    expect(splitByKeyword('aXbXc', 'x')).toEqual([
      { hit: false, text: 'a' },
      { hit: true, text: 'X' },
      { hit: false, text: 'b' },
      { hit: true, text: 'X' },
      { hit: false, text: 'c' },
    ]);
  });

  it('returns a single plain part when the keyword is blank or absent', () => {
    expect(splitByKeyword('用户管理', '')).toEqual([
      { hit: false, text: '用户管理' },
    ]);
    expect(splitByKeyword('用户管理', '角色')).toEqual([
      { hit: false, text: '用户管理' },
    ]);
  });
});
