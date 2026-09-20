<script lang="ts" setup>
import { Fallback } from '@describeadmin/ui';

import { ElButton } from 'element-plus';

import { useAuthStore } from '#/store';

defineOptions({ name: 'NoAccess' });

const authStore = useAuthStore();

/**
 * 整页重载，而不是 router.push。
 *
 * 菜单由 `/auth/menus` 实时查库（AuthController.menus），管理员补完授权，用户在这里
 * 刷一下就能拿到新菜单——守卫会在 generateAccess 之后把他送去第一个有权限的页面。
 * 光是路由跳转不行：accessStore.isAccessChecked 已经是 true，守卫会直接放行，
 * 不会再打一次 /auth/menus。
 */
function reload() {
  location.reload();
}

/** 退出登录。按钮级权限（accessCodes）是登录时的快照，只有重登才会刷新。 */
async function handleLogout() {
  await authStore.logout(false);
}
</script>

<template>
  <Fallback
    status="403"
    title="暂无可用页面"
    description="当前账号还没有被分配任何可访问的页面。请联系管理员开通权限，开通后点「重新加载」即可进入；若已开通仍看不到菜单，请退出后重新登录。"
  >
    <template #action>
      <div class="flex gap-3">
        <ElButton
          type="primary"
          size="large"
          data-testid="no-access-reload-btn"
          @click="reload"
        >
          重新加载
        </ElButton>
        <ElButton
          size="large"
          data-testid="no-access-logout-btn"
          @click="handleLogout"
        >
          退出登录
        </ElButton>
      </div>
    </template>
  </Fallback>
</template>
