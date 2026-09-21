<script lang="ts" setup>
import type { TreeNodeData } from 'element-plus/es/components/tree/src/tree.type';

import type { OptionItem, SysMenu, SysRole } from '../../api';
import type { SearchFormSchema } from '../../composables/useSearchForm';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { usePermission } from '@describeadmin/access';
import { ConfirmDialog } from '@describeadmin/ele-ui';
import { Page } from '@describeadmin/ui';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTooltip,
  ElTree,
  ElTreeSelect,
} from 'element-plus';

import {
  assignRoleDeptsApi,
  assignRoleMenusApi,
  createRoleApi,
  DATA_SCOPE_OPTIONS,
  deleteRoleApi,
  getDeptOptionsApi,
  getRoleDeptsApi,
  getRoleGrantableMenusApi,
  getRoleListApi,
  getRoleMenusApi,
  updateRoleApi,
} from '../../api';
import { cascadeCheck } from '../../composables/useGrantTree';
import { useSearchForm } from '../../composables/useSearchForm';

defineOptions({ name: 'SystemRole' });

/** 按钮级权限（CLAUDE.md 4.5.3）。前缀须与 seed-rbac.sql 登记的 perm_code 一致。 */
const { can, canAny } = usePermission('system:role');

/** DataScopeType.CUSTOM 的 code，见后端 DataScopeType 枚举。 */
const DATA_SCOPE_CUSTOM = 2;

const loading = ref(false);
const rows = ref<SysRole[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });

const filter = reactive<{ roleCode: string; roleName: string }>({
  roleCode: '',
  roleName: '',
});

const searchSchema: SearchFormSchema[] = [
  {
    component: 'Input',
    componentProps: { 'data-testid': 'role-search-role-name-input' },
    fieldName: 'roleName',
    label: '角色名称',
  },
  {
    component: 'Input',
    componentProps: { 'data-testid': 'role-search-role-code-input' },
    fieldName: 'roleCode',
    label: '角色标识',
  },
];

const { SearchFormBar } = useSearchForm({
  testid: 'role',
  schema: searchSchema,
  async onSearch(values) {
    Object.assign(filter, values);
    page.current = 1;
    await load();
  },
  async onReset() {
    filter.roleName = '';
    filter.roleCode = '';
    page.current = 1;
    await load();
  },
});

const formVisible = ref(false);
const submitting = ref(false);
const editingId = ref<null | number>(null);
const formRef = ref();

const form = reactive<SysRole>({
  dataScope: 1,
  homePath: null,
  roleCode: '',
  roleName: '',
  sort: 0,
});

const rules = {
  roleCode: [{ required: true, message: '请输入角色标识', trigger: 'blur' }],
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
};

const confirmVisible = ref(false);
const deletingId = ref<null | number>(null);

const menuVisible = ref(false);
const menuTree = ref<SysMenu[]>([]);
const checkedMenuIds = ref<number[]>([]);
const menuRoleId = ref<null | number>(null);
const menuTreeRef = ref();
/** 已勾选项数，供管理员在提交前一眼看出不是 0（弹窗里树很长，滚动后看不全）。 */
const menuCheckedCount = ref(0);

const deptVisible = ref(false);
// 只要 id + 名称，所以走部门模块只要求登录的选项接口，而不是要 system:dept:list 的
// /dept/tree——否则「能管角色」和「能看部门管理」被迫捆绑（CLAUDE.md 4.11）。
const deptTree = ref<OptionItem[]>([]);
const checkedDeptIds = ref<number[]>([]);
const deptRoleId = ref<null | number>(null);
const deptTreeRef = ref();
const deptCheckedCount = ref(0);

/**
 * 「首页」选择器用的完整菜单树，页面挂载时拉一次，供所有角色的编辑弹窗共用。
 *
 * 取自 `/api/system/role/grantable-menus`（角色模块，按 `system:role:list` 校验）
 * 而不是 `/api/system/menu/tree`（要 `system:menu:list`）：分配菜单与选首页都是
 * **角色管理自己的功能**，数据该由角色模块提供。这里需要 `menuType`/`path`
 * 判断哪些节点可选，通用 `OptionItem` 形状覆盖不了，所以不走 /options。
 */
const allMenuTree = ref<SysMenu[]>([]);

/**
 * 正在编辑的角色**已授权**的菜单 id；`null` 表示不过滤（新增角色时）。
 *
 * 用来把「首页」下拉限制在该角色真正勾过的菜单内。此前这个下拉列的是全量菜单树，
 * 管理员可以给角色选一个它根本没授权的页面——用户登录后那个 path 解析不到任何路由，
 * 直接落进 404，且报错里没有任何东西指向"首页配错了"。路由守卫那边已经加了兜底
 * （改落到第一个有权限的页面），这里是从源头堵住。
 */
const editingRoleMenuIds = ref<null | Set<string>>(null);

interface HomePathMenuNode extends SysMenu {
  children?: HomePathMenuNode[];
  /** 是否可选：只有真实页面（MENU 且有 path）可选，目录/按钮只作分组展示。 */
  selectable: boolean;
  /**
   * ElTreeSelect 的 node-key：可选节点直接用真实 path（登录后就是靠这个路径路由，
   * 系统内路径本身就唯一）；不可选的分组节点用菜单 id 兜底，避免多个空 path 的
   * 目录节点互相冲突。
   */
  treeKey: string;
}

/**
 * 只保留真实页面节点可选，目录/按钮仅做分组——避免选到假路径，登录后 404。
 *
 * @param granted 该角色已授权的菜单 id；传 `null` 表示不按授权过滤。id 在链路上是
 *   字符串（Long 序列化为字符串，见 CLAUDE.md 4.8），比对统一转字符串。
 */
function buildHomePathTree(
  nodes: SysMenu[],
  granted: null | Set<string>,
): HomePathMenuNode[] {
  const result: HomePathMenuNode[] = [];
  for (const node of nodes) {
    const children = buildHomePathTree(node.children ?? [], granted);
    const selectable =
      node.menuType === 'MENU' &&
      !!node.path &&
      (granted === null || granted.has(String(node.id)));
    // 没授权的页面节点会退化成"不可选"，若它又没有可选后代，整枝在这里被剪掉
    if (!selectable && children.length === 0) {
      continue;
    }
    result.push({
      ...node,
      children,
      selectable,
      treeKey: selectable ? (node.path as string) : `group-${node.id}`,
    });
  }
  return result;
}

const homePathTree = computed(() =>
  buildHomePathTree(allMenuTree.value, editingRoleMenuIds.value),
);

/**
 * 存量脏数据：库里记着的首页已经不在该角色的授权范围内（或那条菜单被删了）。
 * 树里找不到对应节点，ElTreeSelect 会原样显示那串 path，不提示的话管理员看不出
 * 它其实是坏的。
 */
const homePathUnauthorized = computed(() => {
  const granted = editingRoleMenuIds.value;
  if (editingId.value === null || !form.homePath || granted === null) {
    return false;
  }
  return !hasSelectablePath(homePathTree.value, form.homePath);
});

function hasSelectablePath(nodes: HomePathMenuNode[], path: string): boolean {
  return nodes.some(
    (node) =>
      (node.selectable && node.path === path) ||
      hasSelectablePath(node.children ?? [], path),
  );
}

async function load() {
  loading.value = true;
  try {
    const result = await getRoleListApi({
      ...page,
      roleCode: filter.roleCode || undefined,
      roleName: filter.roleName || undefined,
    });
    rows.value = result.records;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  // 新角色还没有任何菜单授权，按授权过滤会得到一棵空树、根本选不了首页——
  // 维持列全量的现状。新角色的首页配错了，守卫那边仍有兜底。
  editingRoleMenuIds.value = null;
  Object.assign(form, {
    dataScope: 1,
    homePath: null,
    roleCode: '',
    roleName: '',
    sort: 0,
  });
  formVisible.value = true;
}

async function openEdit(row: SysRole) {
  editingId.value = row.id ?? null;
  // 先拿该角色已授权的菜单，用来把「首页」下拉限制在其中。
  // 失败时退回不过滤并照常开窗——错误提示由请求层的全局拦截器负责，不该因为这个
  // 辅助请求挂了就把整个编辑弹窗卡住。
  try {
    const owned = await getRoleMenusApi(row.id as number);
    editingRoleMenuIds.value = new Set(owned.map(String));
  } catch {
    editingRoleMenuIds.value = null;
  }
  Object.assign(form, {
    dataScope: row.dataScope ?? 1,
    homePath: row.homePath ?? null,
    roleCode: row.roleCode ?? '',
    roleName: row.roleName ?? '',
    sort: row.sort ?? 0,
    version: row.version,
  });
  formVisible.value = true;
}

async function submit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    await (editingId.value === null
      ? createRoleApi({ ...form })
      : updateRoleApi(editingId.value, { ...form }));
    ElMessage.success(editingId.value === null ? '新增成功' : '保存成功');
    formVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

function askDelete(row: SysRole) {
  deletingId.value = row.id ?? null;
  confirmVisible.value = true;
}

async function confirmDelete() {
  if (deletingId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    await deleteRoleApi(deletingId.value);
    ElMessage.success('删除成功');
    confirmVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

/**
 * 两棵授权树都是 `check-strictly` + 手写的单向级联，见 `composables/useGrantTree.ts`
 * 里那段关于「为什么不用 ElTree 默认父子联动」的说明。
 *
 * 一句话：父 MENU 节点自己就带 `xxx:list` 权限点，而联动模式下父节点的勾选态由子节点
 * 推导——「只给列表权限」（父勾、子全不勾）在那个模式下根本表达不出来。
 *
 * ⚠️ 不要"顺手"去掉 `check-strictly` 恢复成联动，那会让这个授权状态再次无法表达。
 */
function onMenuCheck(data: TreeNodeData) {
  cascadeCheck(menuTreeRef.value, menuTree.value, (data as SysMenu).id);
  menuCheckedCount.value = menuTreeRef.value?.getCheckedKeys().length ?? 0;
}

function onDeptCheck(data: TreeNodeData) {
  cascadeCheck(deptTreeRef.value, deptTree.value, (data as OptionItem).value);
  deptCheckedCount.value = deptTreeRef.value?.getCheckedKeys().length ?? 0;
}

async function openAssignMenu(row: SysRole) {
  menuRoleId.value = row.id ?? null;
  const [all, owned] = await Promise.all([
    getRoleGrantableMenusApi(),
    getRoleMenusApi(row.id as number),
  ]);
  menuTree.value = all;
  // check-strictly 下 setCheckedKeys 是精确回填、零级联，直接塞已授权 id 即可。
  // （非严格模式才需要先把集合降解成叶子，否则父节点的勾选会级联铺满全部子节点。）
  checkedMenuIds.value = owned;
  menuVisible.value = true;
  // ElDialog 的内容首次打开才渲染、关闭后不销毁，default-checked-keys 只在那一次
  // 生效：换个角色再打开时不显式回填，看到的会是上一个角色的勾选状态。
  await nextTick();
  menuTreeRef.value?.setCheckedKeys(checkedMenuIds.value);
  menuCheckedCount.value = menuTreeRef.value?.getCheckedKeys().length ?? 0;
}

async function submitAssignMenu() {
  if (menuRoleId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    // check-strictly 下不产生半选，getCheckedKeys() 就是完整的勾选集合。
    // 祖先由后端 SysRoleService.assignMenus 闭包补齐——那是「子路由要有挂载点」
    // 这条不变量的唯一写入口，不再要求每个调用方记得提交半选父节点。
    const ids = menuTreeRef.value.getCheckedKeys() as number[];
    await assignRoleMenusApi(menuRoleId.value, ids);
    ElMessage.success('授权成功');
    menuVisible.value = false;
  } finally {
    submitting.value = false;
  }
}

async function openAssignDept(row: SysRole) {
  deptRoleId.value = row.id ?? null;
  const [tree, owned] = await Promise.all([
    getDeptOptionsApi(),
    getRoleDeptsApi(row.id as number),
  ]);
  deptTree.value = tree;
  // 同 openAssignMenu：check-strictly 下精确回填
  checkedDeptIds.value = owned;
  deptVisible.value = true;
  // 同 openAssignMenu
  await nextTick();
  deptTreeRef.value?.setCheckedKeys(checkedDeptIds.value);
  deptCheckedCount.value = deptTreeRef.value?.getCheckedKeys().length ?? 0;
}

async function submitAssignDept() {
  if (deptRoleId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    // ⚠️ 这里过去连半选的父节点一起提交，照搬了 submitAssignMenu 的理由——那个结论
    // 放在部门树上是错的，而且是一个数据权限越授：部门树在这里根本不用于渲染，
    // 它只是选值，DeptDataPermissionHandler 的 CUSTOM 档生成的是 dept_id IN (...)，
    // 精确集合成员判定。半选的父部门被一并提交 = 角色能看到父部门的业务数据。
    // 所以部门这边只交真正勾上的，后端 assignDataScopeDepts 也刻意不做祖先闭包。
    const ids = deptTreeRef.value.getCheckedKeys() as number[];
    await assignRoleDeptsApi(deptRoleId.value, ids);
    ElMessage.success('授权成功');
    deptVisible.value = false;
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  try {
    allMenuTree.value = await getRoleGrantableMenusApi();
    await load();
  } catch {
    // 已经由请求层的全局拦截器处理（弹出提示、401 时跳转登录页），这里只需要
    // 避免异常继续冒泡成 Vue 的 "Unhandled error during execution of mounted hook"。
  }
});
</script>

<template>
  <Page title="角色管理">
    <!-- 角色与菜单授权由框架的 framework-system-starter 提供——实现说明，不面向最终用户。 -->
    <template #extra>
      <ElButton
        v-if="can('add')"
        type="primary"
        data-testid="role-add-btn"
        @click="openCreate"
      >
        新增
      </ElButton>
    </template>

    <SearchFormBar />

    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="id"
      data-testid="role-table"
    >
      <ElTableColumn prop="roleName" label="角色名称" min-width="160" />
      <ElTableColumn prop="roleCode" label="角色标识" min-width="160" />
      <ElTableColumn label="数据范围" width="120">
        <template #default="{ row }">
          {{
            DATA_SCOPE_OPTIONS.find((option) => option.value === row.dataScope)
              ?.label ?? '-'
          }}
        </template>
      </ElTableColumn>
      <ElTableColumn prop="sort" label="排序" width="80" />
      <ElTableColumn prop="createTime" label="创建时间" min-width="180" />
      <ElTableColumn
        v-if="canAny('assign-menu', 'assign-dept', 'edit', 'remove')"
        label="操作"
        width="320"
        fixed="right"
      >
        <template #default="{ row }">
          <ElButton
            v-if="can('assign-menu')"
            link
            type="primary"
            data-testid="role-assign-menu-btn"
            @click="openAssignMenu(row)"
          >
            分配菜单
          </ElButton>
          <!-- v-if 挂在 ElTooltip 上而不是里面的 ElButton：无权限时连提示一起摘掉，
               否则会留下一个能 hover 出气泡、却没有按钮的空壳。 -->
          <ElTooltip
            v-if="can('assign-dept')"
            :disabled="row.dataScope === DATA_SCOPE_CUSTOM"
            content="仅数据范围为「自定义部门」的角色可分配"
          >
            <ElButton
              link
              type="primary"
              :disabled="row.dataScope !== DATA_SCOPE_CUSTOM"
              data-testid="role-assign-dept-btn"
              @click="openAssignDept(row)"
            >
              分配数据权限
            </ElButton>
          </ElTooltip>
          <ElButton
            v-if="can('edit')"
            link
            type="primary"
            data-testid="role-edit-btn"
            @click="openEdit(row)"
          >
            编辑
          </ElButton>
          <ElButton
            v-if="can('remove')"
            link
            type="danger"
            data-testid="role-delete-btn"
            @click="askDelete(row)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="mt-4 flex justify-end">
      <ElPagination
        v-model:current-page="page.current"
        v-model:page-size="page.size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        data-testid="role-pagination"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <ElDialog
      v-model="formVisible"
      :title="editingId === null ? '新增角色' : '编辑角色'"
      width="520px"
      append-to-body
      data-testid="role-form-dialog"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem label="角色名称" prop="roleName">
          <ElInput
            v-model="form.roleName"
            data-testid="role-role-name-input"
            placeholder="请输入角色名称"
          />
        </ElFormItem>
        <ElFormItem label="角色标识" prop="roleCode">
          <ElInput
            v-model="form.roleCode"
            data-testid="role-role-code-input"
            placeholder="如 ADMIN，用于后端 hasRole 判断"
          />
        </ElFormItem>
        <ElFormItem label="排序" prop="sort">
          <ElInputNumber
            v-model="form.sort"
            :min="0"
            data-testid="role-sort-input"
          />
        </ElFormItem>
        <ElFormItem label="数据范围" prop="dataScope">
          <ElSelect
            v-model="form.dataScope"
            data-testid="role-data-scope-select"
          >
            <ElOption
              v-for="option in DATA_SCOPE_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="首页" prop="homePath">
          <ElTreeSelect
            v-model="form.homePath"
            :data="homePathTree"
            :props="{
              children: 'children',
              disabled: (data: TreeNodeData) =>
                !(data as HomePathMenuNode).selectable,
              label: 'menuName',
            }"
            node-key="treeKey"
            check-strictly
            clearable
            placeholder="不选则使用全局默认首页"
            data-testid="role-home-path-select"
          />
          <div
            v-if="homePathUnauthorized"
            class="mt-1 w-full text-xs text-[var(--el-color-danger)]"
            data-testid="role-home-path-warning"
          >
            当前首页
            {{ form.homePath }}
            不在该角色已授权的菜单内，用户登录后将进不去，请重新选择。
          </div>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton data-testid="role-cancel-btn" @click="formVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="role-submit-btn"
          @click="submit"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="menuVisible"
      title="分配菜单"
      width="520px"
      append-to-body
      data-testid="role-menu-dialog"
    >
      <p class="mb-2 text-sm text-gray-500" data-testid="role-menu-count">
        已选 {{ menuCheckedCount }} 项
      </p>
      <ElTree
        ref="menuTreeRef"
        :data="menuTree"
        :props="{ children: 'children', label: 'menuName' }"
        :default-checked-keys="checkedMenuIds"
        node-key="id"
        show-checkbox
        check-strictly
        default-expand-all
        data-testid="role-menu-tree"
        @check="(data: TreeNodeData) => onMenuCheck(data)"
      />
      <template #footer>
        <ElButton
          data-testid="role-menu-cancel-btn"
          @click="menuVisible = false"
        >
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="role-menu-submit-btn"
          @click="submitAssignMenu"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="deptVisible"
      title="分配数据权限"
      width="520px"
      append-to-body
      data-testid="role-dept-dialog"
    >
      <p class="mb-2 text-sm text-gray-500" data-testid="role-dept-count">
        已选 {{ deptCheckedCount }} 项
      </p>
      <!--
        刻意不把 OptionItem 的 disabled 映射进 :props。用户表单里「停用部门不可选」是对的，
        这里不是：某个部门停用之前可能已经被授给了这个角色，映射过去就变成
        勾着、却取消不掉——管理员连收回这条数据权限都做不到。
      -->
      <ElTree
        ref="deptTreeRef"
        :data="deptTree"
        :props="{ children: 'children', label: 'label' }"
        :default-checked-keys="checkedDeptIds"
        node-key="value"
        show-checkbox
        check-strictly
        default-expand-all
        data-testid="role-dept-tree"
        @check="(data: TreeNodeData) => onDeptCheck(data)"
      />
      <template #footer>
        <ElButton
          data-testid="role-dept-cancel-btn"
          @click="deptVisible = false"
        >
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="role-dept-submit-btn"
          @click="submitAssignDept"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ConfirmDialog
      v-model="confirmVisible"
      testid="role"
      :loading="submitting"
      @confirm="confirmDelete"
    />
  </Page>
</template>
