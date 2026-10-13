<script lang="ts" setup>
import type { ActiveSession } from '../../api';
import type { SearchFormSchema } from '../../composables/useSearchForm';

import { onMounted, reactive, ref } from 'vue';

import { usePermission } from '@describeadmin/access';
import { ConfirmDialog } from '@describeadmin/ele-ui';
import { useUserStore } from '@describeadmin/stores';
import { Page } from '@describeadmin/ui';

import {
  ElButton,
  ElMessage,
  ElPagination,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import { forceLogoutApi, getOnlineListApi } from '../../api';
import { useSearchForm } from '../../composables/useSearchForm';

defineOptions({ name: 'SystemOnline' });

/** 按钮级权限（CLAUDE.md 4.5.3）。前缀须与 seed-rbac.sql 登记的 perm_code 一致。 */
const { can } = usePermission('system:online');

const userStore = useUserStore();

const loading = ref(false);
const rows = ref<ActiveSession[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });

const filter = reactive<{ username: string }>({ username: '' });

const searchSchema: SearchFormSchema[] = [
  {
    component: 'Input',
    componentProps: { 'data-testid': 'online-search-username-input' },
    fieldName: 'username',
    label: '用户名',
  },
];

const { SearchFormBar } = useSearchForm({
  testid: 'online',
  schema: searchSchema,
  async onSearch(values) {
    Object.assign(filter, values);
    page.current = 1;
    await load();
  },
  async onReset() {
    filter.username = '';
    page.current = 1;
    await load();
  },
});

const submitting = ref(false);
const confirmVisible = ref(false);
const loggingOutUserId = ref<null | number>(null);
const loggingOutName = ref('');
/** 要踢的就是自己：强制下线按用户吊销全部令牌，当前这个登录也会一起失效。 */
const loggingOutSelf = ref(false);

async function load() {
  loading.value = true;
  try {
    const result = await getOnlineListApi({
      ...page,
      username: filter.username || undefined,
    });
    rows.value = result.records;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function askForceLogout(row: ActiveSession) {
  loggingOutUserId.value = row.userId;
  loggingOutName.value = row.nickname || row.username;
  // userId 后端按 4.8 序列化成字符串，userInfo.userId 也是字符串，统一转字符串再比
  loggingOutSelf.value =
    row.current || String(row.userId) === String(userStore.userInfo?.userId);
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
    <SearchFormBar />

    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="sessionId"
      data-testid="online-table"
    >
      <!-- 同一用户可有多条会话，userId 不唯一，不能当 row-key -->
      <ElTableColumn prop="username" label="用户名" min-width="150">
        <template #default="{ row }">
          <span>{{ row.username }}</span>
          <ElTag
            v-if="row.current"
            class="ml-2"
            size="small"
            type="success"
            data-testid="online-current-tag"
          >
            当前
          </ElTag>
        </template>
      </ElTableColumn>
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
      <ElTableColumn
        v-if="can('remove')"
        label="操作"
        width="110"
        fixed="right"
      >
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
      :message="
        loggingOutSelf
          ? `将吊销 ${loggingOutName} 的全部登录令牌，包括你当前正在使用的这个登录，确定后需要重新登录。确定继续？`
          : `将吊销 ${loggingOutName} 的全部登录令牌，确定继续？`
      "
      @confirm="confirmForceLogout"
    />
  </Page>
</template>
