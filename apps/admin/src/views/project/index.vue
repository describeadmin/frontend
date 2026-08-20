<script lang="ts" setup>
import type { Project } from '#/api/project';

import { onMounted, reactive, ref } from 'vue';

import { ConfirmDialog } from '@describeadmin/ele-ui';
import { Page } from '@describeadmin/ui';

import {
  ElButton,
  ElDatePicker,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElPagination,
  ElSwitch,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import {
  createProjectApi,
  deleteProjectApi,
  getProjectListApi,
  updateProjectApi,
} from '#/api/project';

defineOptions({ name: 'Project' });

const loading = ref(false);
const rows = ref<Project[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });

/** 查询条件。空值不提交，交给后端按「空则不筛选」处理。 */
const search = reactive({
  projectName: undefined as string | undefined,
  projectCode: undefined as string | undefined,
  ownerDeptId: undefined as number | undefined,
  startDateEnd: undefined as string | undefined,
  startDateStart: undefined as string | undefined,
  status: undefined as number | undefined,
});

const formVisible = ref(false);
const submitting = ref(false);
const editingId = ref<null | number>(null);
const formRef = ref();

const form = reactive({
  projectName: '',
  projectCode: '',
  ownerDeptId: undefined as number | undefined,
  budget: undefined as number | undefined,
  startDate: '',
  status: 1,
  remark: '',
});

const rules = {
  projectName: [{ required: true, message: '请填写项目名称', trigger: 'blur' }],
  status: [{ required: true, message: '请填写状态', trigger: 'blur' }],
};

const confirmVisible = ref(false);
const deletingId = ref<null | number>(null);

async function load() {
  loading.value = true;
  try {
    const result = await getProjectListApi({ ...page, ...search });
    rows.value = result.records;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function doSearch() {
  page.current = 1;
  return load();
}

function resetSearch() {
  for (const key of Object.keys(search)) {
    (search as Record<string, unknown>)[key] = undefined;
  }
  return doSearch();
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, {
    projectName: '',
    projectCode: '',
    ownerDeptId: undefined as number | undefined,
    budget: undefined as number | undefined,
    startDate: '',
    status: 1,
    remark: '',
  });
  formVisible.value = true;
}

function openEdit(row: Project) {
  editingId.value = row.id ?? null;
  Object.assign(form, row);
  formVisible.value = true;
}

async function submit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    await (editingId.value === null
      ? createProjectApi({ ...form })
      : updateProjectApi(editingId.value, { ...form }));
    ElMessage.success(editingId.value === null ? '新增成功' : '保存成功');
    formVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

function askDelete(row: Project) {
  deletingId.value = row.id ?? null;
  confirmVisible.value = true;
}

async function confirmDelete() {
  if (deletingId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    await deleteProjectApi(deletingId.value);
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
  <Page description="由 codegen 生成，可直接修改" title="项目">
    <template #extra>
      <ElButton
        type="primary"
        data-testid="project-add-btn"
        @click="openCreate"
      >
        新增
      </ElButton>
    </template>

    <ElForm inline class="mb-2" data-testid="project-search-form">
      <ElFormItem label="项目名称">
        <ElInput
          v-model="search.projectName"
          clearable
          data-testid="project-project-name-search"
          placeholder="请输入"
          @keyup.enter="doSearch"
        />
      </ElFormItem>
      <ElFormItem label="项目编号">
        <ElInput
          v-model="search.projectCode"
          clearable
          data-testid="project-project-code-search"
          placeholder="请输入"
          @keyup.enter="doSearch"
        />
      </ElFormItem>
      <ElFormItem label="归口部门ID">
        <ElInput
          v-model="search.ownerDeptId"
          clearable
          data-testid="project-owner-dept-id-search"
          placeholder="请输入"
          @keyup.enter="doSearch"
        />
      </ElFormItem>
      <ElFormItem label="开始日期（起）">
        <ElInput
          v-model="search.startDateStart"
          clearable
          data-testid="project-start-date-start-search"
          placeholder="请输入"
          @keyup.enter="doSearch"
        />
      </ElFormItem>
      <ElFormItem label="开始日期（止）">
        <ElInput
          v-model="search.startDateEnd"
          clearable
          data-testid="project-start-date-end-search"
          placeholder="请输入"
          @keyup.enter="doSearch"
        />
      </ElFormItem>
      <ElFormItem label="状态">
        <ElInput
          v-model="search.status"
          clearable
          data-testid="project-status-search"
          placeholder="请输入"
          @keyup.enter="doSearch"
        />
      </ElFormItem>
      <ElFormItem>
        <ElButton
          type="primary"
          data-testid="project-search-btn"
          @click="doSearch"
        >
          查询
        </ElButton>
        <ElButton data-testid="project-reset-btn" @click="resetSearch">
          重置
        </ElButton>
      </ElFormItem>
    </ElForm>

    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="id"
      data-testid="project-table"
    >
      <ElTableColumn prop="projectName" label="项目名称" min-width="140" />
      <ElTableColumn prop="projectCode" label="项目编号" min-width="140" />
      <ElTableColumn prop="ownerDeptId" label="归口部门ID" min-width="140" />
      <ElTableColumn prop="budget" label="预算金额" min-width="140" />
      <ElTableColumn prop="startDate" label="开始日期" min-width="140" />
      <ElTableColumn prop="status" label="状态" min-width="140" />
      <ElTableColumn label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <ElButton
            link
            type="primary"
            data-testid="project-edit-btn"
            @click="openEdit(row)"
          >
            编辑
          </ElButton>
          <ElButton
            link
            type="danger"
            data-testid="project-delete-btn"
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
        data-testid="project-pagination"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <ElDialog
      v-model="formVisible"
      :title="editingId === null ? '新增项目' : '编辑项目'"
      width="560px"
      append-to-body
      data-testid="project-form-dialog"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="110px">
        <ElFormItem label="项目名称" prop="projectName">
          <ElInput
            v-model="form.projectName"
            data-testid="project-project-name-input"
            placeholder="请输入项目名称"
          />
        </ElFormItem>
        <ElFormItem label="项目编号" prop="projectCode">
          <ElInput
            v-model="form.projectCode"
            data-testid="project-project-code-input"
            placeholder="请输入项目编号"
          />
        </ElFormItem>
        <ElFormItem label="归口部门ID" prop="ownerDeptId">
          <ElInputNumber
            v-model="form.ownerDeptId"
            :step="1"
            data-testid="project-owner-dept-id-input"
          />
        </ElFormItem>
        <ElFormItem label="预算金额" prop="budget">
          <ElInputNumber
            v-model="form.budget"
            :precision="2"
            :step="1"
            data-testid="project-budget-input"
          />
        </ElFormItem>
        <ElFormItem label="开始日期" prop="startDate">
          <ElDatePicker
            v-model="form.startDate"
            type="date"
            value-format="YYYY-MM-DD"
            data-testid="project-start-date-input"
            placeholder="请选择开始日期"
          />
        </ElFormItem>
        <ElFormItem label="状态" prop="status">
          <ElSwitch
            v-model="form.status"
            :active-value="1"
            :inactive-value="0"
            data-testid="project-status-input"
          />
        </ElFormItem>
        <ElFormItem label="备注" prop="remark">
          <ElInput
            v-model="form.remark"
            type="textarea"
            :rows="3"
            data-testid="project-remark-input"
            placeholder="请输入备注"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton data-testid="project-cancel-btn" @click="formVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="project-submit-btn"
          @click="submit"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ConfirmDialog
      v-model="confirmVisible"
      testid="project"
      :loading="submitting"
      @confirm="confirmDelete"
    />
  </Page>
</template>
