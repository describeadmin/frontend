<script lang="ts" setup>
import type { ActiveSession } from '../../api';

import { onMounted, reactive, ref } from 'vue';

import { ConfirmDialog } from '@describeadmin/ele-ui';
import { Page } from '@describeadmin/ui';

import {
  ElButton,
  ElMessage,
  ElPagination,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import { forceLogoutApi, getOnlineListApi } from '../../api';

defineOptions({ name: 'SystemOnline' });

const loading = ref(false);
const rows = ref<ActiveSession[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });

const submitting = ref(false);
const confirmVisible = ref(false);
const loggingOutUserId = ref<null | number>(null);
const loggingOutName = ref('');

async function load() {
  loading.value = true;
  try {
    const result = await getOnlineListApi({ ...page });
    rows.value = result.records;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function askForceLogout(row: ActiveSession) {
  loggingOutUserId.value = row.userId;
  loggingOutName.value = row.nickname || row.username;
  confirmVisible.value = true;
}

async function confirmForceLogout() {
  if (loggingOutUserId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    await forceLogoutApi(loggingOutUserId.value);
    ElMessage.success('已强制下线');
    confirmVisible.value = false;
    // 踢完人可能导致当前页空了，回到第一页再拉
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
  <Page title="在线用户">
    <!--
      在线会话数据来自框架的 TokenStore，没有对应的数据库表；默认的 InMemoryTokenStore 只持有
      本实例会话——多实例部署时这条对运维有实际意义，但措辞是实现细节，不适合直接展示给最终用户，
      故不放进 Page 的 description。分页由后端 SysOnlineController 对全量快照切片得到。
    -->
    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="userId"
      data-testid="online-table"
    >
      <ElTableColumn prop="username" label="用户名" min-width="120" />
      <ElTableColumn prop="nickname" label="昵称" min-width="120" />
      <ElTableColumn prop="authType" label="登录方式" min-width="100" />
      <ElTableColumn prop="ip" label="登录IP" min-width="130">
        <template #default="{ row }">{{ row.ip || '—' }}</template>
      </ElTableColumn>
      <ElTableColumn prop="device" label="登录设备" min-width="150">
        <template #default="{ row }">{{ row.device || '—' }}</template>
      </ElTableColumn>
      <ElTableColumn prop="issuedAt" label="登录时间" min-width="170" />
      <ElTableColumn prop="expiresAt" label="过期时间" min-width="170" />
      <ElTableColumn label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <ElButton
            link
            type="danger"
            data-testid="online-force-logout-btn"
            @click="askForceLogout(row)"
          >
            强制下线
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
        data-testid="online-pagination"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <ConfirmDialog
      v-model="confirmVisible"
      testid="online"
      :loading="submitting"
      title="强制下线"
      :message="`将吊销 ${loggingOutName} 的全部登录令牌，确定继续？`"
      @confirm="confirmForceLogout"
    />
  </Page>
</template>
