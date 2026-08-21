<script lang="ts" setup>
import type { TreeNodeData } from 'element-plus/es/components/tree/src/tree.type';

import type { SysDept, SysMenu, SysRole } from '../../api';

import { computed, onMounted, reactive, ref } from 'vue';

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
  getDeptTreeApi,
  getMenuTreeApi,
  getRoleDeptsApi,
  getRoleListApi,
  getRoleMenusApi,
  updateRoleApi,
} from '../../api';

defineOptions({ name: 'SystemRole' });

/** DataScopeType.CUSTOM 的 code，见后端 DataScopeType 枚举。 */
const DATA_SCOPE_CUSTOM = 2;

const loading = ref(false);
const rows = ref<SysRole[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });

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

const deptVisible = ref(false);
const deptTree = ref<SysDept[]>([]);
const checkedDeptIds = ref<number[]>([]);
const deptRoleId = ref<null | number>(null);
const deptTreeRef = ref();

/** "首页"选择器用的完整菜单树，页面挂载时拉一次，供所有角色的编辑弹窗共用。 */
const allMenuTree = ref<SysMenu[]>([]);

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

/** 只保留真实页面节点可选，目录/按钮仅做分组——避免选到假路径，登录后 404。 */
function buildHomePathTree(nodes: SysMenu[]): HomePathMenuNode[] {
  const result: HomePathMenuNode[] = [];
  for (const node of nodes) {
    const children = buildHomePathTree(node.children ?? []);
    const selectable = node.menuType === 'MENU' && !!node.path;
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

const homePathTree = computed(() => buildHomePathTree(allMenuTree.value));

async function load() {
  loading.value = true;
  try {
    const result = await getRoleListApi({ ...page });
    rows.value = result.records;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, {
    dataScope: 1,
    homePath: null,
    roleCode: '',
    roleName: '',
    sort: 0,
  });
  formVisible.value = true;
}

function openEdit(row: SysRole) {
  editingId.value = row.id ?? null;
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

async function openAssignMenu(row: SysRole) {
  menuRoleId.value = row.id ?? null;
  const [all, owned] = await Promise.all([
    getMenuTreeApi(),
    getRoleMenusApi(row.id as number),
  ]);
  menuTree.value = all;
  checkedMenuIds.value = owned;
  menuVisible.value = true;
}

async function submitAssignMenu() {
  if (menuRoleId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    // 半选的父节点也要提交：只交全选节点会让「只授了子菜单」的角色丢掉目录，
    // 前端生成路由时子路由就没有挂载点了
    const ids = [
      ...menuTreeRef.value.getCheckedKeys(),
      ...menuTreeRef.value.getHalfCheckedKeys(),
    ] as number[];
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
    getDeptTreeApi(),
    getRoleDeptsApi(row.id as number),
  ]);
  deptTree.value = tree;
  checkedDeptIds.value = owned;
  deptVisible.value = true;
}

async function submitAssignDept() {
  if (deptRoleId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    // 半选的父节点也要提交，理由与 submitAssignMenu 一致：只交全选节点会让
    // 「只授了子部门」的角色在部门树里丢掉父级挂载点
    const ids = [
      ...deptTreeRef.value.getCheckedKeys(),
      ...deptTreeRef.value.getHalfCheckedKeys(),
    ] as number[];
    await assignRoleDeptsApi(deptRoleId.value, ids);
    ElMessage.success('授权成功');
    deptVisible.value = false;
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  allMenuTree.value = await getMenuTreeApi();
  await load();
});
</script>

<template>
  <Page
    description="角色与菜单授权由框架的 framework-system-starter 提供"
    title="角色管理"
  >
    <template #extra>
      <ElButton type="primary" data-testid="role-add-btn" @click="openCreate">
        新增
      </ElButton>
    </template>

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
      <ElTableColumn label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <ElButton
            link
            type="primary"
            data-testid="role-assign-menu-btn"
            @click="openAssignMenu(row)"
          >
            分配菜单
          </ElButton>
          <ElTooltip
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
            link
            type="primary"
            data-testid="role-edit-btn"
            @click="openEdit(row)"
          >
            编辑
          </ElButton>
          <ElButton
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
      <ElTree
        ref="menuTreeRef"
        :data="menuTree"
        :props="{ children: 'children', label: 'menuName' }"
        :default-checked-keys="checkedMenuIds"
        node-key="id"
        show-checkbox
        default-expand-all
        data-testid="role-menu-tree"
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
      <ElTree
        ref="deptTreeRef"
        :data="deptTree"
        :props="{ children: 'children', label: 'deptName' }"
        :default-checked-keys="checkedDeptIds"
        node-key="id"
        show-checkbox
        default-expand-all
        data-testid="role-dept-tree"
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
