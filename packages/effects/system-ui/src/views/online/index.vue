<script lang="ts" setup>
import type { ActiveSession } from '../../api';

import { onMounted, ref } from 'vue';

import { ConfirmDialog } from '@describeadmin/ele-ui';
import { Page } from '@describeadmin/ui';

import { ElButton, ElMessage, ElTable, ElTableColumn } from 'element-plus';

import { forceLogoutApi, getOnlineListApi } from '../../api';

defineOptions({ name: 'SystemOnline' });

const loading = ref(false);
const rows = ref<ActiveSession[]>([]);

const submitting = ref(false);
const confirmVisible = ref(false);
const loggingOutUserId = ref<null | number>(null);
const loggingOutName = ref('');

async function load() {
  loading.value = true;
  try {
    rows.value = await getOnlineListApi();
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
    await load();
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page
    description="在线会话数据来自框架的 TokenStore，没有对应的数据库表；默认的 InMemoryTokenStore 只持有本实例会话"
    title="在线用户"
  >
    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="userId"
      data-testid="online-table"
    >
      <ElTableColumn prop="username" label="用户名" min-width="140" />
      <ElTableColumn prop="nickname" label="昵称" min-width="140" />
      <ElTableColumn prop="authType" label="登录方式" min-width="120" />
      <ElTableColumn prop="issuedAt" label="登录时间" min-width="180" />
      <ElTableColumn prop="expiresAt" label="过期时间" min-width="180" />
      <ElTableColumn label="操作" width="120" fixed="right">
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
