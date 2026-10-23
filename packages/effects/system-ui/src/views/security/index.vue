<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { usePermission } from '@describeadmin/access';
import { ConfirmDialog } from '@describeadmin/ele-ui';
import { Page } from '@describeadmin/ui';

import { ElButton, ElMessage, ElTable, ElTableColumn } from 'element-plus';

import { getLockedAccountsApi, unlockAccountApi } from '../../api';

defineOptions({ name: 'SystemSecurity' });

/** 按钮级权限（CLAUDE.md 4.5.3）。前缀须与 0002-rbac-seed.sql 登记的 perm_code 一致。 */
const { can } = usePermission('system:security');

const loading = ref(false);
const usernames = ref<string[]>([]);
/** ElTable 要对象行；后端只给用户名，这里包一层。 */
const rows = computed(() => usernames.value.map((username) => ({ username })));

const submitting = ref(false);
const confirmVisible = ref(false);
const unlockingName = ref('');

async function load() {
  loading.value = true;
  try {
    usernames.value = await getLockedAccountsApi();
  } finally {
    loading.value = false;
  }
}

function askUnlock(username: string) {
  unlockingName.value = username;
  confirmVisible.value = true;
}

async function confirmUnlock() {
  submitting.value = true;
  try {
    await unlockAccountApi(unlockingName.value);
    ElMessage.success('已解锁');
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
    // 已由请求层的全局拦截器处理，这里只避免异常冒泡成 mounted 钩子的未处理错误
  }
});
</script>

<template>
  <Page
    title="登录锁定"
    description="连续登录失败次数过多的账号会被临时锁定，到期自动解锁。误锁时可在这里提前解锁。"
  >
    <!--
      数据来自框架 LoginAttemptGuard 的失败计数（存在 CacheProvider 里），没有数据库表。
      计数按登录时输入的用户名统计、统一转小写，不存在的用户名同样计数（否则「会不会被锁」
      本身就成了账号枚举信道），所以列表里可能出现系统中并不存在的用户名。
    -->
    <template #extra>
      <ElButton
        :loading="loading"
        data-testid="security-refresh-btn"
        @click="load"
      >
        刷新
      </ElButton>
    </template>

    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="username"
      empty-text="当前没有被锁定的账号"
      data-testid="security-table"
    >
      <ElTableColumn prop="username" label="用户名" min-width="200" />
      <ElTableColumn
        v-if="can('unlock')"
        label="操作"
        width="110"
        fixed="right"
      >
        <template #default="{ row }">
          <ElButton
            link
            type="primary"
            data-testid="security-unlock-btn"
            @click="askUnlock(row.username)"
          >
            解锁
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ConfirmDialog
      v-model="confirmVisible"
      testid="security"
      :loading="submitting"
      title="解锁账号"
      :message="`将清除 ${unlockingName} 的登录失败次数，对方可以立即重新登录。确定继续？`"
      @confirm="confirmUnlock"
    />
  </Page>
</template>
