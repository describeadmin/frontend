/**
 * 菜单树 / 路由树里凡是带 path 和 children 的节点，本模块只关心这两个字段。
 * 同时兼容 `MenuRecordRaw` 与 `RouteRecordRaw`，故不直接绑定其中任一类型。
 */
interface PathTreeNode {
  children?: PathTreeNode[];
  path?: string;
}

/**
 * 取树里第一个「能直接打开」的页面路径（深度优先的最左叶子）。
 *
 * <p>用途是给「首页进不去」的账号找一个兜底落地页：角色没设默认首页、或设了却没有该页面的
 * 授权时，`defaultHomePath` 解析不出任何路由，用户会被甩到 404——而 404 页上既没有侧边栏
 * 也没有退出入口，非技术用户就此走投无路。这里给出的是该账号<b>确实被授过权</b>的第一个
 * 页面；从菜单树取则天然按 sort 排好序。
 *
 * <p>带路由参数的路径（`/detail/:id`）会被跳过：缺参数拼不出可用 URL，跳过去还是 404。
 * 父节点只在自己没有任何可用子节点时才会被采用——目录节点通常只是个容器，
 * 它的 path 未必挂着真实页面。
 */
function firstReachablePath(nodes?: PathTreeNode[]): null | string {
  for (const node of nodes ?? []) {
    const fromChild = firstReachablePath(node.children);
    if (fromChild) {
      return fromChild;
    }
    if (node.path && !node.path.includes(':')) {
      return node.path;
    }
  }
  return null;
}

export { firstReachablePath };
