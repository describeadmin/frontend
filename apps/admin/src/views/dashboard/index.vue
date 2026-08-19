<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { Page } from '@describeadmin/ui';
import { useUserStore } from '@describeadmin/stores';

import { ElCard, ElCol, ElRow, ElStatistic, ElTag } from 'element-plus';

import {
  getDeptTreeApi,
  getMenuTreeApi,
  getRoleListApi,
  getUserListApi,
} from '#/api';

defineOptions({ name: 'Dashboard' });

const userStore = useUserStore();

/**
 * 首页刻意只展示真实数据。
 *
 * 上游的 analytics / workspace 两个页面是对着 mock 后端的演示，图表数字全是写死的，
 * 里面的快捷入口还指向已被删除的 /demos/*。把演示页当产品首页交付，
 * 使用者第一眼看到的就是假数据——那比没有首页更糟。
 */
const counts = ref({ dept: 0, menu: 0, role: 0, user: 0 });
const loading = ref(true);

function countTree(nodes: { children?: any[] }[]): number {
  return nodes.reduce(
    (sum, n) => sum + 1 + countTree(n.children ?? []),
    0,
  );
}

onMounted(async () => {
  try {
    const [users, roles, menus, depts] = await Promise.all([
      getUserListApi({ current: 1, size: 1 }),
      getRoleListApi({ current: 1, size: 1 }),
      getMenuTreeApi(),
      getDeptTreeApi(),
    ]);
    counts.value = {
      dept: countTree(depts),
      menu: countTree(menus),
      role: roles.total,
      user: users.total,
    };
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <Page description="以下数字均来自后端真实接口，不是演示数据" title="工作台">
    <ElCard v-loading="loading" class="mb-4" data-testid="dashboard-welcome-card">
      <div class="text-lg font-medium">
        欢迎回来，{{ userStore.userInfo?.realName ?? '' }}
      </div>
      <div class="mt-2">
        <ElTag
          v-for="role in userStore.userInfo?.roles ?? []"
          :key="role"
          class="mr-2"
          type="primary"
        >
          {{ role }}
        </ElTag>
      </div>
      <p class="text-foreground/60 mt-3 text-sm">
        用户、角色、菜单、部门四项系统管理能力由 framework-system-starter 提供，
        业务方引入依赖即拥有，无需自己实现。
      </p>
    </ElCard>

    <ElRow :gutter="16" data-testid="dashboard-stats">
      <ElCol :md="6" :sm="12" :xs="24">
        <ElCard><ElStatistic :value="counts.user" title="用户" /></ElCard>
      </ElCol>
      <ElCol :md="6" :sm="12" :xs="24">
        <ElCard><ElStatistic :value="counts.role" title="角色" /></ElCard>
      </ElCol>
      <ElCol :md="6" :sm="12" :xs="24">
        <ElCard><ElStatistic :value="counts.menu" title="菜单与权限点" /></ElCard>
      </ElCol>
      <ElCol :md="6" :sm="12" :xs="24">
        <ElCard><ElStatistic :value="counts.dept" title="部门" /></ElCard>
      </ElCol>
    </ElRow>
  </Page>
</template>
