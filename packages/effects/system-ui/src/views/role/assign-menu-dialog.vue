<script lang="ts" setup>
import type { TreeNodeData } from 'element-plus/es/components/tree/src/tree.type';

import type { SysMenu } from '../../api';

import { computed, nextTick, ref, watch } from 'vue';

import { ElButton, ElDialog, ElInput, ElMessage, ElTree } from 'element-plus';

import { assignRoleMenusApi, getRoleMenusApi } from '../../api';
import {
  applyCheckedChanges,
  cascadeCheck,
} from '../../composables/useGrantTree';
import {
  filterMenuTree,
  splitByKeyword,
  summarizeChecked,
} from '../../composables/useMenuFilter';

/**
 * 「分配菜单」弹窗。
 *
 * 从 `role/index.vue` 拆出来的原因只有一个：菜单一多，光是一棵全展开的树根本没法操作。
 * 检索 / 批量勾选 / 摘要三件事各自都要状态，塞在角色列表页里会让那个文件变成第二个
 * 菜单模块。三者的纯逻辑在 `composables/useMenuFilter.ts`，这里只管接线。
 *
 * 两条不能碰的约束（CLAUDE.md 4.5.2）：
 * - `check-strictly` + `cascadeCheck` 的勾选联动，**不要换回 ElTree 默认父子联动**；
 * - `:data` 永远绑**全量**树。检索靠 `filter-node-method`，只改节点可见性——
 *   把过滤结果塞回 `:data` 会让被过滤掉的节点连同勾选态一起从 `nodesMap` 里消失，
 *   提交时静默撤销那些授权（理由见 `useMenuFilter.ts` 头部）。
 */
interface Props {
  /**
   * 可授权的菜单树。宿主页挂载时拉一次、「首页」下拉也共用这一份，
   * 这里不重复请求（`grantable-menus` 要的是 `system:role:list`，同一份数据）。
   */
  menus: SysMenu[];
  /** 正在分配的角色。打开时用它拉已授权菜单，提交时用它落库。 */
  roleId: null | number;
  /** 只用于弹窗标题，让人确认自己改的是哪个角色。 */
  roleName?: string;
}

const props = withDefaults(defineProps<Props>(), { roleName: '' });

const visible = defineModel<boolean>({ required: true });

const loading = ref(false);
const submitting = ref(false);
const keyword = ref('');
/**
 * 树当前的勾选 id。**唯一来源是 ElTree 自己**（`getCheckedKeys()`），
 * 任何一侧改了勾选就重新取一次——不另存一份可能落后的副本。
 */
const checkedIds = ref<unknown[]>([]);
/** 展开 / 收起按钮的呈现态。手动点某个节点不会回写它，和菜单管理页一致。 */
const expandAll = ref(true);

const treeRef = ref();

const filterResult = computed(() => filterMenuTree(props.menus, keyword.value));
const summary = computed(() => summarizeChecked(props.menus, checkedIds.value));

/**
 * 菜单树拿到了才允许提交。
 *
 * 树现在由宿主页挂载时取一次（与「首页」下拉共用），那次请求失败的话这里是空树：
 * 此时"勾选集合"天然是空集，点确定就是**把该角色的授权清空**，而界面上一片祥和。
 * 宁可禁用按钮。
 */
const menusReady = computed(() => props.menus.length > 0);

function syncChecked() {
  checkedIds.value = (treeRef.value?.getCheckedKeys() as unknown[]) ?? [];
}

/**
 * 喂给 ElTree 的 `filter-node-method`。
 *
 * 判据取自 `filterMenuTree` 已经算好的 `visibleIds`，而不是在谓词里就地递归——
 * 谓词对每个节点都要跑一次，就地递归会退化成 O(n²)，几百个菜单的主线程里卡一下很明显。
 */
function filterNode(_value: string, data: TreeNodeData) {
  if (!keyword.value.trim()) {
    return true;
  }
  return filterResult.value.visibleIds.has(String((data as SysMenu).id));
}

/** 节点名称按当前关键字切片，模板里分段渲染就是高亮（不用 `v-html`）。 */
function nameParts(menuName: null | string | undefined) {
  return splitByKeyword(menuName ?? '', keyword.value);
}

function hitClass(hit: boolean) {
  return hit ? 'text-[var(--el-color-primary)]' : '';
}

/**
 * 与 `role/index.vue` 的部门树完全一致：`check-strictly` 下 ElTree 不做任何级联，
 * 所以勾选后手写单向级联（勾父带子、补祖先；取消只带子孙）。
 */
function onCheck(data: TreeNodeData) {
  cascadeCheck(treeRef.value, props.menus, (data as SysMenu).id);
  syncChecked();
}

function walkMenus(nodes: SysMenu[], visit: (node: SysMenu) => void) {
  for (const node of nodes) {
    visit(node);
    if (node.children?.length) {
      walkMenus(node.children, visit);
    }
  }
}

/**
 * 展开 / 收起全部。
 *
 * 树仍用 `default-expand-all` 打开（几百个菜单也是一屏之内能滚的），但菜单多的时候
 * 需要能折起来扫一眼顶层结构，再配合检索定位——收起之后没有展开手段就成了死路。
 *
 * 用节点的 `expand()` / `collapse()` 而不是受控的 `default-expanded-keys`：后者只在
 * 首次渲染生效，用户手动展开过某枝之后「收起全部」点了没反应。
 */
function toggleExpandAll() {
  const next = !expandAll.value;
  walkMenus(props.menus, (node) => {
    const treeNode = treeRef.value?.getNode(node.id);
    if (next) {
      treeNode?.expand?.();
    } else {
      treeNode?.collapse?.();
    }
  });
  expandAll.value = next;
}

/** 把当前关键字推给 ElTree（打开时重置、清空输入框时也要用同一段）。 */
function applyFilter() {
  treeRef.value?.filter(keyword.value.trim());
}

/**
 * 检索：`filter()` 只改节点的 `visible`，然后把命中路径展开。
 *
 * 不展开的话，树被收起过（或用户刚点了「收起全部」）时搜出来的东西全藏在折叠节点里，
 * 看起来就是"什么都没搜到"。
 */
watch(keyword, () => {
  applyFilter();
  if (!keyword.value.trim()) {
    return;
  }
  walkMenus(filterResult.value.tree, (node) => {
    treeRef.value?.getNode(node.id)?.expand?.();
  });
});

/**
 * 批量勾选 / 取消勾选「当前检索结果」。
 *
 * 关键字为空时检索结果就是全量，所以这两个按钮同时也是「全选 / 全不选」。
 * 走 `applyCheckedChanges`（起点是树当前态）而不是自己拼 id 数组：见 `useGrantTree.ts`。
 */
function batchCheck(checked: boolean) {
  applyCheckedChanges(
    treeRef.value,
    props.menus,
    filterResult.value.matchedIds,
    checked,
  );
  syncChecked();
}

/**
 * 打开时拉该角色已授权的菜单。
 *
 * 挂在 `@open` 而不是 `watch(visible)`：ElDialog 的内容首次打开才渲染，
 * `open` 事件发出时树一定已经在 DOM 上，不必靠 nextTick 赌渲染时机。
 *
 * `loading` 一直扛到回填完成：`v-loading` 的遮罩同时挡住点击，避免"树已经能点、
 * 但已授权集合还在路上"的窗口期——那一瞬间点下去，随后的 `setCheckedKeys` 会把
 * 这次点击覆盖掉，看起来就是点了没反应。
 */
async function handleOpen() {
  if (props.roleId === null) {
    visible.value = false;
    return;
  }
  keyword.value = '';
  expandAll.value = true;
  loading.value = true;
  try {
    checkedIds.value = await getRoleMenusApi(props.roleId);
    await nextTick();
    // ElDialog 关闭后不销毁内容，`default-checked-keys` 只在首次渲染生效：
    // 换个角色再打开时不显式回填，看到的会是上一个角色的勾选状态。
    // 上一轮留下的检索可见性也要一并清掉（keyword 已重置为空）。
    applyFilter();
    treeRef.value?.setCheckedKeys(checkedIds.value);
    syncChecked();
  } catch {
    // 提示由请求层的全局拦截器负责。这里必须关窗——留着一个"看着能改、其实没有数据"
    // 的弹窗，管理员点确定就等于把该角色的授权清空。
    visible.value = false;
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (props.roleId === null) {
    return;
  }
  submitting.value = true;
  try {
    // `check-strictly` 下不产生半选，getCheckedKeys() 就是完整的勾选集合（含被检索
    // 过滤掉的节点，看的是 store 全量遍历）。祖先由后端 `assignMenus` 闭包补齐——
    // 那是"子路由要有挂载点"这条不变量的唯一写入口。
    const ids = (treeRef.value?.getCheckedKeys() as number[]) ?? [];
    await assignRoleMenusApi(props.roleId, ids);
    ElMessage.success('授权成功');
    visible.value = false;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="roleName ? `分配菜单 · ${roleName}` : '分配菜单'"
    width="720px"
    append-to-body
    data-testid="role-menu-dialog"
    @open="handleOpen"
  >
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <ElInput
        v-model="keyword"
        class="!w-64"
        clearable
        placeholder="搜索菜单名称 / 权限标识 / 路径"
        data-testid="role-menu-search-input"
      />
      <ElButton
        :disabled="filterResult.matchedIds.size === 0"
        data-testid="role-menu-select-all-btn"
        @click="batchCheck(true)"
      >
        全选结果
      </ElButton>
      <ElButton
        :disabled="filterResult.matchedIds.size === 0"
        data-testid="role-menu-unselect-all-btn"
        @click="batchCheck(false)"
      >
        取消全选结果
      </ElButton>
      <ElButton
        data-testid="role-menu-expand-toggle-btn"
        @click="toggleExpandAll"
      >
        {{ expandAll ? '收起全部' : '展开全部' }}
      </ElButton>
    </div>

    <div class="mb-2 flex flex-wrap items-baseline gap-x-3 text-sm">
      <span data-testid="role-menu-count">已选 {{ summary.total }} 项</span>
      <span
        class="text-muted-foreground text-xs"
        data-testid="role-menu-summary"
      >
        目录 {{ summary.dir }} · 菜单 {{ summary.menu }} · 按钮
        {{ summary.button }}
      </span>
      <span
        v-if="keyword.trim()"
        class="text-muted-foreground text-xs"
        data-testid="role-menu-matched-count"
      >
        检索命中 {{ filterResult.matchedIds.size }} 项
      </span>
    </div>

    <!-- 固定高度的滚动区：几百个菜单展开后弹窗会顶出屏幕，页脚的确定按钮就够不着了。 -->
    <div
      v-loading="loading"
      class="max-h-[52vh] min-h-40 overflow-auto rounded border border-[var(--el-border-color-lighter)] p-2"
    >
      <ElTree
        ref="treeRef"
        :data="menus"
        :props="{ children: 'children', label: 'menuName' }"
        :filter-node-method="filterNode"
        node-key="id"
        show-checkbox
        check-strictly
        default-expand-all
        data-testid="role-menu-tree"
        @check="(data: TreeNodeData) => onCheck(data)"
      >
        <!-- 自定义插槽：名称高亮 + 类型/权限标识。用插槽后 ElTree 不再渲染
             `.el-tree-node__label`，e2e 要按 `.el-tree-node__content` 里的
             `.role-menu-node-name` 定位（CLAUDE.md 4.5.2）。 -->
        <template #default="{ data }">
          <span class="flex min-w-0 items-center gap-2">
            <span class="role-menu-node-name truncate">
              <template
                v-for="(part, index) in nameParts(data.menuName)"
                :key="index"
              >
                <span :class="hitClass(part.hit)">{{ part.text }}</span>
              </template>
            </span>
            <!-- 名称之外的两个信息都是授权时会看错的点：按钮靠权限标识区分、
                 隐藏页（visible=0）不进侧边栏但**必须授权**才有路由。 -->
            <span
              v-if="data.menuType === 'BUTTON'"
              class="text-muted-foreground shrink-0 text-xs"
            >
              {{ data.permCode }}
            </span>
            <span
              v-else-if="data.menuType === 'DIR'"
              class="text-muted-foreground shrink-0 text-xs"
            >
              目录
            </span>
            <span
              v-else-if="data.visible === 0"
              class="shrink-0 text-xs text-[var(--el-color-warning)]"
            >
              隐藏
            </span>
          </span>
        </template>
      </ElTree>
      <p
        v-if="!menusReady"
        class="text-muted-foreground px-2 py-8 text-center text-sm"
        data-testid="role-menu-unavailable"
      >
        菜单树没有加载出来，为避免误清空该角色的授权，这里不能提交。
        请关闭弹窗、刷新页面后重试。
      </p>
      <p
        v-else-if="filterResult.empty"
        class="text-muted-foreground px-2 py-8 text-center text-sm"
        data-testid="role-menu-empty"
      >
        没有匹配「{{ keyword }}」的菜单
      </p>
    </div>

    <template #footer>
      <ElButton data-testid="role-menu-cancel-btn" @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="primary"
        :disabled="!menusReady"
        :loading="submitting"
        data-testid="role-menu-submit-btn"
        @click="submit"
      >
        确定
      </ElButton>
    </template>
  </ElDialog>
</template>
