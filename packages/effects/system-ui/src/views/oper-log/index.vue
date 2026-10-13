<script lang="ts" setup>
import type { SysOperLog } from '../../api';
import type { SearchFormSchema } from '../../composables/useSearchForm';

import { computed, onMounted, reactive, ref } from 'vue';

import { usePermission } from '@describeadmin/access';
import { ConfirmDialog } from '@describeadmin/ele-ui';
import { Page } from '@describeadmin/ui';

import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElMessage,
  ElPagination,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import {
  cleanOperLogApi,
  deleteOperLogApi,
  getOperLogListApi,
} from '../../api';
import { useSearchForm } from '../../composables/useSearchForm';
import { prettyJson } from '../../utils/pretty-json';

defineOptions({ name: 'SystemOperLog' });

/** 按钮级权限（CLAUDE.md 4.5.3）。前缀须与 seed-rbac.sql 登记的 perm_code 一致。 */
const { can } = usePermission('system:oper-log');

const loading = ref(false);
const rows = ref<SysOperLog[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });

const filter = reactive<{
  end: string;
  module: string;
  operatorName: string;
  start: string;
  status: null | number;
}>({
  end: '',
  module: '',
  operatorName: '',
  start: '',
  status: null,
});

/**
 * 搜索栏改用 `useSearchForm` 统一封装，见该文件顶部的说明——折叠检索栏 +
 * 搜索/清空按钮 + 外层卡片背景不用每个列表页自己拼一遍。时间范围拆成开始/结束
 * 两个独立的 `DatePicker` 字段，而不是一个 `daterange` 型字段：后者要靠
 * adapter 把单个 fieldName 拆成 `[name, name_end]` 两个值再提交，这条路径在本仓
 * 还没有别的页面验证过；拆成两个平级字段直接对应 `OperLogQuery.start`/`.end`，
 * 是更少假设、更好核实的写法。
 */
const searchSchema: SearchFormSchema[] = [
  {
    component: 'Input',
    componentProps: { 'data-testid': 'oper-log-search-module-input' },
    fieldName: 'module',
    label: '模块',
  },
  {
    component: 'Input',
    componentProps: { 'data-testid': 'oper-log-search-operator-name-input' },
    fieldName: 'operatorName',
    label: '操作人',
  },
  {
    component: 'Select',
    componentProps: {
      'data-testid': 'oper-log-search-status-select',
      options: [
        { label: '成功', value: 1 },
        { label: '失败', value: 0 },
      ],
    },
    fieldName: 'status',
    label: '状态',
  },
  {
    component: 'DatePicker',
    componentProps: {
      'data-testid': 'oper-log-search-start-picker',
      type: 'datetime',
      valueFormat: 'YYYY-MM-DDTHH:mm:ss',
    },
    fieldName: 'start',
    label: '开始时间',
  },
  {
    component: 'DatePicker',
    componentProps: {
      'data-testid': 'oper-log-search-end-picker',
      type: 'datetime',
      valueFormat: 'YYYY-MM-DDTHH:mm:ss',
    },
    fieldName: 'end',
    label: '结束时间',
  },
];

const { SearchFormBar } = useSearchForm({
  testid: 'oper-log',
  schema: searchSchema,
  async onSearch(values) {
    Object.assign(filter, values);
    page.current = 1;
    await load();
  },
  async onReset() {
    filter.module = '';
    filter.operatorName = '';
    filter.status = null;
    filter.start = '';
    filter.end = '';
    page.current = 1;
    await load();
  },
});

const submitting = ref(false);
const confirmVisible = ref(false);
const deletingId = ref<null | number>(null);
const cleanConfirmVisible = ref(false);

/**
 * 详情直接用列表行里的数据：后端分页本来就返回全部列（请求参数、错误信息都在），
 * 没必要为此再开一个 `GET /{id}`。日志只追加不修改，也不存在"列表里的是旧值"的问题。
 */
const detailVisible = ref(false);
const detail = ref<null | SysOperLog>(null);
const detailParam = computed(() => prettyJson(detail.value?.requestParam));

function openDetail(row: SysOperLog) {
  detail.value = row;
  detailVisible.value = true;
}

async function load() {
  loading.value = true;
  try {
    const result = await getOperLogListApi({
      ...page,
      end: filter.end || undefined,
      module: filter.module || undefined,
      operatorName: filter.operatorName || undefined,
      start: filter.start || undefined,
      status: filter.status ?? undefined,
    });
    rows.value = result.records;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
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
  <Page title="操作日志">
    <!-- 操作日志由框架的 framework-system-starter 提供，BaseController+ 的写操作与 @OperLog 标注端点自动记录——实现说明，不面向最终用户。 -->
    <template #extra>
      <ElButton
        v-if="can('remove')"
        type="danger"
        plain
        data-testid="oper-log-clean-btn"
        @click="cleanConfirmVisible = true"
      >
        清空
      </ElButton>
    </template>

    <SearchFormBar />

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
      <!-- 能进这个页面就有 list 权限，详情不再单独判定，所以操作列总是渲染。 -->
      <ElTableColumn label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <ElButton
            link
            type="primary"
            data-testid="oper-log-detail-btn"
            @click="openDetail(row)"
          >
            详情
          </ElButton>
          <ElButton
            v-if="can('remove')"
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

    <ElDialog
      v-model="detailVisible"
      title="操作日志详情"
      width="760px"
      data-testid="oper-log-detail-dialog"
    >
      <template v-if="detail">
        <ElDescriptions :column="2" border data-testid="oper-log-detail-desc">
          <ElDescriptionsItem label="模块">
            {{ detail.module }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="操作描述">
            {{ detail.description }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="操作人">
            {{ detail.operatorName || '-' }}
            <span v-if="detail.operatorId" class="text-muted-foreground">
              (ID: {{ detail.operatorId }})
            </span>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="IP">
            {{ detail.operatorIp || '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="请求" :span="2">
            <span data-testid="oper-log-detail-request">
              {{ detail.httpMethod || '-' }} {{ detail.requestUrl || '' }}
            </span>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="状态">
            <ElTag :type="detail.status === 1 ? 'success' : 'danger'">
              {{ detail.status === 1 ? '成功' : '失败' }}
            </ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="耗时">
            {{ detail.costTime ?? '-' }} ms
          </ElDescriptionsItem>
          <ElDescriptionsItem label="操作时间" :span="2">
            {{ detail.createTime }}
          </ElDescriptionsItem>
        </ElDescriptions>

        <div class="mt-4 mb-2 font-medium">
          请求参数
          <span
            v-if="detailParam.truncated"
            class="text-muted-foreground ml-2 text-xs font-normal"
          >
            超过 2000 字符，已截断
          </span>
        </div>
        <pre
          class="bg-muted max-h-80 overflow-auto rounded p-3 text-xs leading-5 break-all whitespace-pre-wrap"
          data-testid="oper-log-detail-param"
          v-text="detailParam.text || '（无）'"
        ></pre>

        <template v-if="detail.errorMsg">
          <div class="mt-4 mb-2 font-medium">错误信息</div>
          <pre
            class="bg-muted text-destructive max-h-60 overflow-auto rounded p-3 text-xs leading-5 break-all whitespace-pre-wrap"
            data-testid="oper-log-detail-error"
            v-text="detail.errorMsg"
          ></pre>
        </template>
      </template>
    </ElDialog>

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
