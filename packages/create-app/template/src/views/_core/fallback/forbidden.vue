<script lang="ts" setup>
import { computed } from 'vue';

import { NO_ACCESS_PATH } from '@describeadmin/constants';
import { useAccessStore } from '@describeadmin/stores';
import { Fallback } from '@describeadmin/ui';
import { firstReachablePath } from '@describeadmin/utils';

defineOptions({ name: 'Fallback403Demo' });

const accessStore = useAccessStore();

/** 同 not-found.vue：默认的 `'/'` 会绕回没权限的默认首页，见那里的注释。 */
const homePath = computed(
  () => firstReachablePath(accessStore.accessMenus) ?? NO_ACCESS_PATH,
);
</script>

<template>
  <Fallback status="403" :home-path="homePath" />
</template>
