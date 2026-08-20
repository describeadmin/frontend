<script lang="ts" setup>
import type { SysDept } from '#/api';

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
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTreeSelect,
} from 'element-plus';

import {
  createDeptApi,
  deleteDeptApi,
  getDeptTreeApi,
  updateDeptApi,
} from '#/api';

defineOptions({ name: 'SystemDept' });

const loading = ref(false);
const tree = ref<SysDept[]>([]);

const formVisible = ref(false);
const submitting = ref(false);
const editingId = ref<null | number>(null);
const formRef = ref();

/**
 * 表单模型刻意不直接用 `SysDept`：实体里的字段大多可空（后端允许 NULL），
 * 而表单控件的 v-model 不接受 null——把可空实体直接当表单模型用，
 * 结果就是每个控件都要额外处理一次 null，或者干脆在类型上撒谎。
 */
interface DeptForm {
  deptName: string;
  leader: string;
  parentId: number;
  phone: string;
  sort: number;
  status: number;
  version?: number;
}

const form = reactive<DeptForm>({
  deptName: '',
  leader: '',
  parentId: 0,
  phone: '',
  sort: 0,
  status: 1,
});

const rules = {
  deptName: [{ required: true, message: '请输入部门名称', trigger: 'blur' }],
};

const confirmVisible = ref(false);
const deletingId = ref<null | number>(null);

/** 顶层选项 0 必须显式给出：后端用 parent_id = 0 表示根，而不是 NULL。 */
const parentOptions = ref<SysDept[]>([]);

async function load() {
  loading.value = true;
  try {
    tree.value = await getDeptTreeApi();
    parentOptions.value = [
      { children: tree.value, deptName: '顶层部门', id: 0 } as SysDept,
    ];
  } finally {
    loading.value = false;
  }
}

function openCreate(parentId: number = 0) {
  editingId.value = null;
  Object.assign(form, {
    deptName: '',
    leader: '',
    parentId,
    phone: '',
    sort: 0,
    status: 1,
  });
  formVisible.value = true;
}

function openEdit(row: SysDept) {
  editingId.value = row.id ?? null;
  Object.assign(form, {
    deptName: row.deptName ?? '',
    leader: row.leader ?? '',
    parentId: row.parentId ?? 0,
    phone: row.phone ?? '',
    sort: row.sort ?? 0,
    status: row.status ?? 1,
    version: row.version,
  });
  formVisible.value = true;
}

async function submit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    await (editingId.value === null
      ? createDeptApi({ ...form })
      : updateDeptApi(editingId.value, { ...form }));
    ElMessage.success(editingId.value === null ? '新增成功' : '保存成功');
    formVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

function askDelete(row: SysDept) {
  deletingId.value = row.id ?? null;
  confirmVisible.value = true;
}

async function confirmDelete() {
  if (deletingId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    await deleteDeptApi(deletingId.value);
    ElMessage.success('删除成功');
    confirmVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page
    description="部门树由框架的 framework-system-starter 提供，业务方无需实现"
    title="部门管理"
  >
    <template #extra>
      <ElButton
        type="primary"
        data-testid="dept-add-btn"
        @click="openCreate(0)"
      >
        新增
      </ElButton>
    </template>

    <ElTable
      v-loading="loading"
      :data="tree"
      row-key="id"
      default-expand-all
      :tree-props="{ children: 'children' }"
      data-testid="dept-table"
    >
      <ElTableColumn prop="deptName" label="部门名称" min-width="200" />
      <ElTableColumn prop="leader" label="负责人" min-width="120" />
      <ElTableColumn prop="phone" label="联系电话" min-width="140" />
      <ElTableColumn prop="sort" label="排序" width="80" />
      <ElTableColumn label="状态" width="90">
        <template #default="{ row }">
          {{ row.status === 1 ? '启用' : '停用' }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <ElButton
            link
            type="primary"
            data-testid="dept-add-child-btn"
            @click="openCreate(row.id)"
          >
            新增下级
          </ElButton>
          <ElButton
            link
            type="primary"
            data-testid="dept-edit-btn"
            @click="openEdit(row)"
          >
            编辑
          </ElButton>
          <ElButton
            link
            type="danger"
            data-testid="dept-delete-btn"
            @click="askDelete(row)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDialog
      v-model="formVisible"
      :title="editingId === null ? '新增部门' : '编辑部门'"
      width="520px"
      append-to-body
      data-testid="dept-form-dialog"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem label="上级部门" prop="parentId">
          <ElTreeSelect
            v-model="form.parentId"
            :data="parentOptions"
            :props="{ children: 'children', label: 'deptName' }"
            node-key="id"
            check-strictly
            data-testid="dept-parent-id-input"
          />
        </ElFormItem>
        <ElFormItem label="部门名称" prop="deptName">
          <ElInput
            v-model="form.deptName"
            data-testid="dept-dept-name-input"
            placeholder="请输入部门名称"
          />
        </ElFormItem>
        <ElFormItem label="负责人" prop="leader">
          <ElInput v-model="form.leader" data-testid="dept-leader-input" />
        </ElFormItem>
        <ElFormItem label="联系电话" prop="phone">
          <ElInput v-model="form.phone" data-testid="dept-phone-input" />
        </ElFormItem>
        <ElFormItem label="排序" prop="sort">
          <ElInputNumber
            v-model="form.sort"
            :min="0"
            data-testid="dept-sort-input"
          />
        </ElFormItem>
        <ElFormItem label="状态" prop="status">
          <ElSwitch
            v-model="form.status"
            :active-value="1"
            :inactive-value="0"
            data-testid="dept-status-input"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton data-testid="dept-cancel-btn" @click="formVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="dept-submit-btn"
          @click="submit"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ConfirmDialog
      v-model="confirmVisible"
      testid="dept"
      :loading="submitting"
      message="删除后该部门将不再出现在列表中（逻辑删除，物理行保留）。确定继续？"
      @confirm="confirmDelete"
    />
  </Page>
</template>
