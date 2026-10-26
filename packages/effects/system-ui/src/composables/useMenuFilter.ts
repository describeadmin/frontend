/**
 * 「分配菜单」弹窗的检索 / 批量 / 摘要。
 *
 * 菜单是树，几百个节点时在一棵全展开的树里翻找不可行，所以给授权树套一层关键字检索。
 *
 * ## 过滤走 ElTree 的 `filter-node-method`，**不是**把过滤结果塞回 `:data`
 *
 * 后者看着直接，实际会**静默丢授权**：ElTree 只为当前 data 里的节点建 `nodesMap`，
 * 把不匹配的节点从数据里拿掉，它们就整个消失了——此时 `getCheckedKeys()` 只返回
 * 看得见的那部分，提交上去等于把看不见的授权全撤了，而界面上一片祥和、重开弹窗才发现
 * 少了东西。`filter()` 只是给节点置 `visible = false`，节点、勾选态、`getCheckedKeys()`
 * 全都不受影响（读的是 `store.getCheckedNodes` 的全量遍历）。
 *
 * 因此本文件提供的是**纯函数**：给 `filter-node-method` 提供 O(1) 的谓词、给批量操作
 * 提供命中集合、给摘要提供计数。弹窗的 `:data` 始终绑全量树。
 *
 * ## 命中的节点整枝保留，祖先只作上下文
 *
 * 搜到「用户管理」通常就是来勾它下面那几个按钮的，所以命中的节点连同全部子孙一起显示；
 * 反过来，命中的节点的祖先必须保留，否则子节点没有挂载点、`filter()` 也救不回来。
 * 但 `matchedIds` 只装**真正命中**的那些——祖先只是让树连得起来的上下文，批量勾选要是
 * 把它们也算进去，一次「全选结果」就会顺手把整个祖先子树授出去。
 */
export interface FilterableMenuNode {
  children?: FilterableMenuNode[];
  id?: number;
  menuName?: null | string;
  /** `DIR` / `MENU` / `BUTTON`，摘要按它分档。 */
  menuType?: null | string;
  path?: null | string;
  permCode?: null | string;
  /** 1 显示 / 0 不进侧边栏。隐藏页也要授权，所以检索命中它、摘要里也计数。 */
  visible?: null | number;
}

/** 关键字命中：名称、权限标识、路由路径，任一包含即算命中。 */
export function matchesKeyword(
  node: FilterableMenuNode,
  keyword: string,
): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [node.menuName, node.permCode, node.path].some((field) =>
    (field ?? '').toLowerCase().includes(needle),
  );
}

/** 树里全部节点 id（含自身），字符串形式。 */
export function collectMenuIds(nodes: FilterableMenuNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (list: FilterableMenuNode[]) => {
    for (const node of list) {
      if (node.id !== null && node.id !== undefined) {
        ids.add(String(node.id));
      }
      walk(node.children ?? []);
    }
  };
  walk(nodes);
  return ids;
}

export interface MenuFilterResult<T extends FilterableMenuNode> {
  /** 检索是否把树筛空了（关键字非空且一个都没命中）。 */
  empty: boolean;
  /**
   * 「检索结果」的节点 id：命中关键字的节点**及其全部子孙**——批量操作按它来。
   *
   * 含子孙是因为「全选结果」的实际效果本来就是"这一片都授出去"（`cascadeCheck`
   * 勾父必带子），两处口径一致，界面上的「检索命中 N 项」才不会和实际改动对不上。
   * 关键字为空时它就是全量：那时"检索结果"就是整棵树，全选才有意义。
   */
  matchedIds: Set<string>;
  /** 过滤后仍然可见的树（命中节点整枝保留，祖先作为上下文保留）。 */
  tree: T[];
  /** 可见节点 id，喂给 `filter-node-method` 做 O(1) 判定。 */
  visibleIds: Set<string>;
}

/**
 * 按关键字过滤菜单树。
 *
 * 命中的节点整枝保留（见文件头），所以 `matchedIds` 与 `visibleIds` 不是一回事：
 * 前者是「检索结果」（命中节点的整枝，批量操作按它来），后者是「渲染得出来的」
 * （再多出祖先链，只为了让树连得起来）。
 */
export function filterMenuTree<T extends FilterableMenuNode>(
  nodes: T[],
  keyword: string,
): MenuFilterResult<T> {
  const needle = keyword.trim().toLowerCase();

  if (!needle) {
    const all = collectMenuIds(nodes);
    return { empty: false, matchedIds: all, tree: nodes, visibleIds: all };
  }

  const matchedIds = new Set<string>();
  const visibleIds = new Set<string>();

  const walk = (list: FilterableMenuNode[]): FilterableMenuNode[] => {
    const kept: FilterableMenuNode[] = [];
    for (const node of list) {
      if (matchesKeyword(node, needle)) {
        // 命中：整枝保留——搜到页面通常就是来勾它下面的按钮的
        for (const id of collectMenuIds([node])) {
          matchedIds.add(id);
          visibleIds.add(id);
        }
        kept.push(node);
        continue;
      }
      const children = walk(node.children ?? []);
      if (children.length > 0) {
        visibleIds.add(String(node.id));
        // 上下文节点是浅拷贝（只换 children），T 上的额外字段原样保留；
        // 但 `children` 在基类型里声明为 FilterableMenuNode[]，类型上只能退一档再断言回来。
        kept.push({ ...node, children });
      }
    }
    return kept;
  };

  const tree = walk(nodes) as T[];
  return { empty: tree.length === 0, matchedIds, tree, visibleIds };
}

export interface MenuTypeSummary {
  button: number;
  dir: number;
  menu: number;
  total: number;
}

/**
 * 已选节点的类型分布，即「已选 12 项」后面那行「目录 2 · 菜单 5 · 按钮 8」。
 *
 * 菜单树一大，只看总数看不出自己到底授了什么：授了 12 项可能是 12 个按钮，
 * 也可能是 12 个整页。
 */
export function summarizeChecked(
  nodes: FilterableMenuNode[],
  checkedIds: Iterable<unknown>,
): MenuTypeSummary {
  const checked = new Set([...checkedIds].map(String));
  const summary: MenuTypeSummary = { button: 0, dir: 0, menu: 0, total: 0 };
  const walk = (list: FilterableMenuNode[]) => {
    for (const node of list) {
      if (checked.has(String(node.id))) {
        summary.total += 1;
        if (node.menuType === 'BUTTON') {
          summary.button += 1;
        } else if (node.menuType === 'DIR') {
          summary.dir += 1;
        } else {
          summary.menu += 1;
        }
      }
      walk(node.children ?? []);
    }
  };
  walk(nodes);
  return summary;
}

export interface TextPart {
  hit: boolean;
  text: string;
}

/**
 * 把节点名称按关键字切成「命中 / 未命中」片段，模板里分段渲染即可高亮。
 *
 * 不用 `v-html` 拼 `<mark>`：菜单名来自数据库，`v-html` 会把里面的尖括号当标签渲染。
 */
export function splitByKeyword(text: string, keyword: string): TextPart[] {
  const needle = keyword.trim().toLowerCase();
  if (!needle || !text) {
    return [{ hit: false, text }];
  }
  const parts: TextPart[] = [];
  const lower = text.toLowerCase();
  let from = 0;
  let at = lower.indexOf(needle);
  while (at !== -1) {
    if (at > from) {
      parts.push({ hit: false, text: text.slice(from, at) });
    }
    parts.push({ hit: true, text: text.slice(at, at + needle.length) });
    from = at + needle.length;
    at = lower.indexOf(needle, from);
  }
  if (from < text.length) {
    parts.push({ hit: false, text: text.slice(from) });
  }
  return parts;
}
