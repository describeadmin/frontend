<script lang="ts" setup>
import type { SysOperLog } from '../../api';

import { onMounted, reactive, ref } from 'vue';

import { ConfirmDialog } from '@describeadmin/ele-ui';
import { Page } from '@describeadmin/ui';

import {
  ElButton,
  ElDatePicker,
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import {
  cleanOperLogApi,
  deleteOperLogApi,
  getOperLogListApi,
} from '../../api';

defineOptions({ name: 'SystemOperLog' });

const loading = ref(false);
const rows = ref<SysOperLog[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });

const filter = reactive<{
  module: string;
  operatorName: string;
  range: [string, string] | null;
  status: null | number;
}>({
  module: '',
  operatorName: '',
  range: null,
  status: null,
});

const submitting = ref(false);
const confirmVisible = ref(false);
const deletingId = ref<null | number>(null);
const cleanConfirmVisible = ref(false);

async function load() {
  loading.value = true;
  try {
    const result = await getOperLogListApi({
      ...page,
      end: filter.range?.[1],
      module: filter.module || undefined,
      operatorName: filter.operatorName || undefined,
      start: filter.range?.[0],
      status: filter.status ?? undefined,
    });
    rows.value = result.records;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function search() {
  page.current = 1;
  load();
}

function resetFilter() {
  filter.module = '';
  filter.operatorName = '';
  filter.status = null;
  filter.range = null;
  search();
}

function askDelete(row: SysOperLog) {
  deletingId.value = row.id ?? null;
  confirmVisible.value = true;
}

async function confirmDelete() {
  if (deletingId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    await deleteOperLogApi(deletingId.value);
    ElMessage.success('删除成功');
    confirmVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

async function confirmClean() {
  submitting.value = true;
  try {
    await cleanOperLogApi();
    ElMessage.success('已清空');
    cleanConfirmVisible.value = false;
    page.current = 1;
    await load();
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page
    description="操作日志由框架的 framework-system-starter 提供，BaseController+ 的写操作与 @OperLog 标注端点自动记录"
    title="操作日志"
  >
    <template #extra>
      <ElButton
        type="danger"
        plain
        data-testid="oper-log-clean-btn"
        @click="cleanConfirmVisible = true"
      >
        清空
      </ElButton>
    </template>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <ElInput
        v-model="filter.module"
        placeholder="模块，如 system:dept"
        clearable
        class="w-48"
        data-testid="oper-log-module-input"
        @keyup.enter="search"
      />
      <ElInput
        v-model="filter.operatorName"
        placeholder="操作人"
        clearable
        class="w-40"
        data-testid="oper-log-operator-name-input"
        @keyup.enter="search"
      />
      <ElSelect
        v-model="filter.status"
        placeholder="状态"
        clearable
        class="w-32"
        data-testid="oper-log-status-select"
      >
        <ElOption label="成功" :value="1" />
        <ElOption label="失败" :value="0" />
      </ElSelect>
      <ElDatePicker
        v-model="filter.range"
        type="datetimerange"
        start-placeholder="开始时间"
        end-placeholder="结束时间"
        value-format="YYYY-MM-DDTHH:mm:ss"
        data-testid="oper-log-range-picker"
      />
      <ElButton
        type="primary"
        data-testid="oper-log-search-btn"
        @click="search"
      >
        查询
      </ElButton>
      <ElButton data-testid="oper-log-reset-btn" @click="resetFilter">
        重置
      </ElButton>
    </div>

    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="id"
      data-testid="oper-log-table"
    >
      <ElTableColumn prop="module" label="模块" min-width="140" />
      <ElTableColumn prop="description" label="操作描述" min-width="160" />
      <ElTableColumn prop="operatorName" label="操作人" min-width="120" />
      <ElTableColumn prop="operatorIp" label="IP" min-width="140" />
      <ElTableColumn label="状态" width="90">
        <template #default="{ row }">
          <ElTag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '成功' : '失败' }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="costTime" label="耗时(ms)" width="100" />
      <ElTableColumn prop="createTime" label="操作时间" min-width="180" />
      <ElTableColumn label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <ElButton
            link
            type="danger"
            data-testid="oper-log-delete-btn"
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
        data-testid="oper-log-pagination"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <ConfirmDialog
      v-model="confirmVisible"
      testid="oper-log"
      :loading="submitting"
      @confirm="confirmDelete"
    />

    <ConfirmDialog
      v-model="cleanConfirmVisible"
      testid="oper-log-clean"
      :loading="submitting"
      message="清空后全部操作日志将被永久删除，且不可恢复，确定继续？"
      @confirm="confirmClean"
    />
  </Page>
</template>
