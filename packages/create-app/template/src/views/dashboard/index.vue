<script lang="ts" setup>
import { computed } from 'vue';

import { useUserStore } from '@describeadmin/stores';
import { Page } from '@describeadmin/ui';

import { ElCard, ElCol, ElRow, ElTag } from 'element-plus';

defineOptions({ name: 'Dashboard' });

const userStore = useUserStore();

/**
 * 工作台首页刻意做成纯静态欢迎页，不请求任何接口。
 *
 * 曾经这里会并发请求 /api/system/user、/api/system/role、/api/system/menu/tree、
 * /api/system/dept/tree 四个接口来算统计数字，但这四个接口分别要求对应模块的
 * `xxx:list` 权限——而"工作台→概览"是登录后必达的首页菜单，理应对任何角色都可用，
 * 不应该反过来要求用户额外具备用户/角色/菜单/部门四个管理模块的权限。
 * 一旦只分配了工作台菜单，这四个请求会全部 403，还会触发全局错误提示。
 *
 * 欢迎信息（姓名、角色）来自登录时已经拿到的 userStore，不需要任何额外请求，
 * 因此天然不受权限影响，对所有登录用户都能正常展示。
 *
 * 本页不放在 @describeadmin/system-ui 里：它不依赖任何 framework-system-starter
 * 实体，纯粹是本应用自己的欢迎/品牌页，业务方大概率会改问候语、亮点文案、快捷入口——
 * 这类内容应该直接归属应用外壳（同 views/_core/profile、views/_core/about 的先例），
 * 而不是随框架 npm 包一起发布、版本化。
 */
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const highlights = [
  { title: '用户与权限', desc: '基于角色的访问控制，权限点精确到按钮级别' },
  { title: '组织架构', desc: '树形部门结构，支持按部门维度划分数据权限' },
  { title: '操作留痕', desc: '关键写操作自动记录操作日志，便于审计追溯' },
  { title: '灵活扩展', desc: '登录方式、消息通道等能力均以插件形式按需接入' },
] as const;
</script>

<template>
  <Page title="工作台">
    <ElCard class="mb-4" data-testid="dashboard-welcome-card">
      <div class="text-lg font-medium">
        {{ greeting }}，{{ userStore.userInfo?.realName ?? '' }}
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
    </ElCard>

    <ElRow :gutter="16" data-testid="dashboard-highlights">
      <ElCol
        v-for="item in highlights"
        :key="item.title"
        :md="6"
        :sm="12"
        :xs="24"
      >
        <ElCard class="mb-4">
          <div class="text-base font-medium">{{ item.title }}</div>
          <div class="text-muted-foreground mt-2 text-sm">{{ item.desc }}</div>
        </ElCard>
      </ElCol>
    </ElRow>
  </Page>
</template>
