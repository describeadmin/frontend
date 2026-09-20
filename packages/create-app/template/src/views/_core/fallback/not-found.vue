<script lang="ts" setup>
import { computed } from 'vue';

import { NO_ACCESS_PATH } from '@describeadmin/constants';
import { useAccessStore } from '@describeadmin/stores';
import { Fallback } from '@describeadmin/ui';
import { firstReachablePath } from '@describeadmin/utils';

defineOptions({ name: 'Fallback404Demo' });

const accessStore = useAccessStore();

/**
 * 「返回首页」要落到一个这个账号真打得开的页面。
 *
 * Fallback 的默认值是 `'/'`，而 `/` 会 redirect 到 preferences.app.defaultHomePath——
 * 对「默认首页本身就没授权」的账号来说，点一次就再回到这个 404，原地打转。
 */
const homePath = computed(
  () => firstReachablePath(accessStore.accessMenus) ?? NO_ACCESS_PATH,
);
</script>

<template>
  <Fallback status="404" :home-path="homePath" />
</template>
