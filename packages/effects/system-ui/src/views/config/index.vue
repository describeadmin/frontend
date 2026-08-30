<script lang="ts" setup>
import type { SysConfig } from '../../api';

import { onMounted, reactive, ref } from 'vue';

import { ConfirmDialog } from '@describeadmin/ele-ui';
import { Page } from '@describeadmin/ui';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElPagination,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import {
  createConfigApi,
  deleteConfigApi,
  getConfigListApi,
  updateConfigApi,
} from '../../api';

defineOptions({ name: 'SystemConfig' });

const loading = ref(false);
const rows = ref<SysConfig[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });

const formVisible = ref(false);
const submitting = ref(false);
const editingId = ref<null | number>(null);
const formRef = ref();

// configType（是否内置）不在表单里——只由种子数据设置，API 新增的参数一律是自定义参数，
// 用户不需要也不应该能手动指定；后端 save 也会强制清空该字段，见 SysConfigService。
const form = reactive<SysConfig>({
  configKey: '',
  configName: '',
  configValue: '',
});

const rules = {
  configKey: [{ required: true, message: '请输入参数键名', trigger: 'blur' }],
  configName: [{ required: true, message: '请输入参数名称', trigger: 'blur' }],
  configValue: [{ required: true, message: '请输入参数键值', trigger: 'blur' }],
};

const confirmVisible = ref(false);
const deletingId = ref<null | number>(null);

async function load() {
  loading.value = true;
  try {
    const result = await getConfigListApi({ ...page });
    rows.value = result.records;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, {
    configKey: '',
    configName: '',
    configValue: '',
  });
  formVisible.value = true;
}

function openEdit(row: SysConfig) {
  editingId.value = row.id ?? null;
  Object.assign(form, {
    configKey: row.configKey ?? '',
    configName: row.configName ?? '',
    configValue: row.configValue ?? '',
    version: row.version,
  });
  formVisible.value = true;
}

async function submit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    await (editingId.value === null
      ? createConfigApi({ ...form })
      : updateConfigApi(editingId.value, { ...form }));
    ElMessage.success(editingId.value === null ? '新增成功' : '保存成功');
    formVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

function askDelete(row: SysConfig) {
  deletingId.value = row.id ?? null;
  confirmVisible.value = true;
}

async function confirmDelete() {
  if (deletingId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    await deleteConfigApi(deletingId.value);
    ElMessage.success('删除成功');
    confirmVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  try {
    await load();
  } catch {
    // 已经由请求层的全局拦截器处理（弹出提示、401 时跳转登录页），这里只需要
    // 避免异常继续冒泡成 Vue 的 "Unhandled error during execution of mounted hook"。
  }
});
</script>

<template>
  <Page title="参数配置">
    <!-- 参数配置由框架的 framework-system-starter 提供，读写均走穿 CacheProvider——实现说明，不面向最终用户。 -->
    <template #extra>
      <ElButton type="primary" data-testid="config-add-btn" @click="openCreate">
        新增
      </ElButton>
    </template>

    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="id"
      data-testid="config-table"
    >
      <ElTableColumn prop="configName" label="参数名称" min-width="160" />
      <ElTableColumn prop="configKey" label="参数键名" min-width="200" />
      <ElTableColumn prop="configValue" label="参数键值" min-width="200" />
      <ElTableColumn label="类型" width="100">
        <template #default="{ row }">
          {{ row.configType === 'Y' ? '内置' : '自定义' }}
        </template>
      </ElTableColumn>
      <ElTableColumn prop="createTime" label="创建时间" min-width="180" />
      <ElTableColumn label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <ElButton
            link
            type="primary"
            data-testid="config-edit-btn"
            @click="openEdit(row)"
          >
            编辑
          </ElButton>
          <ElButton
            link
            type="danger"
            :disabled="row.configType === 'Y'"
            :title="row.configType === 'Y' ? '内置参数不允许删除' : undefined"
            data-testid="config-delete-btn"
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
        data-testid="config-pagination"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <ElDialog
      v-model="formVisible"
      :title="editingId === null ? '新增参数' : '编辑参数'"
      width="520px"
      append-to-body
      data-testid="config-form-dialog"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem label="参数名称" prop="configName">
          <ElInput
            v-model="form.configName"
            data-testid="config-config-name-input"
            placeholder="请输入参数名称"
          />
        </ElFormItem>
        <ElFormItem label="参数键名" prop="configKey">
          <ElInput
            v-model="form.configKey"
            :disabled="editingId !== null"
            data-testid="config-config-key-input"
            placeholder="创建后不可修改"
          />
        </ElFormItem>
        <ElFormItem label="参数键值" prop="configValue">
          <ElInput
            v-model="form.configValue"
            data-testid="config-config-value-input"
            placeholder="请输入参数键值"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton data-testid="config-cancel-btn" @click="formVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="config-submit-btn"
          @click="submit"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ConfirmDialog
      v-model="confirmVisible"
      testid="config"
      :loading="submitting"
      @confirm="confirmDelete"
    />
  </Page>
</template>
