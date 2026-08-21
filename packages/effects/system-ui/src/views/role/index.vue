<script lang="ts" setup>
import type { SysMenu, SysRole } from '../../api';

import { onMounted, reactive, ref } from 'vue';

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
  ElPagination,
  ElTable,
  ElTableColumn,
  ElTree,
} from 'element-plus';

import {
  assignRoleMenusApi,
  createRoleApi,
  deleteRoleApi,
  getMenuTreeApi,
  getRoleListApi,
  getRoleMenusApi,
  updateRoleApi,
} from '../../api';

defineOptions({ name: 'SystemRole' });

const loading = ref(false);
const rows = ref<SysRole[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });

const formVisible = ref(false);
const submitting = ref(false);
const editingId = ref<null | number>(null);
const formRef = ref();

const form = reactive<SysRole>({ roleCode: '', roleName: '', sort: 0 });

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
  Object.assign(form, { roleCode: '', roleName: '', sort: 0 });
  formVisible.value = true;
}

function openEdit(row: SysRole) {
  editingId.value = row.id ?? null;
  Object.assign(form, {
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

onMounted(load);
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
      <ElTableColumn prop="sort" label="排序" width="80" />
      <ElTableColumn prop="createTime" label="创建时间" min-width="180" />
      <ElTableColumn label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <ElButton
            link
            type="primary"
            data-testid="role-assign-menu-btn"
            @click="openAssignMenu(row)"
          >
            分配菜单
          </ElButton>
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

    <ConfirmDialog
      v-model="confirmVisible"
      testid="role"
      :loading="submitting"
      @confirm="confirmDelete"
    />
  </Page>
</template>
