<script setup lang="ts">
import { ref } from 'vue';

import { useUserStore } from '@describeadmin/stores';
import { Profile } from '@describeadmin/ui';

import ProfileBase from './base-setting.vue';
import ProfilePasswordSetting from './password-setting.vue';

// "安全设置"没有对应功能，已删除；"新消息提醒"功能尚未实现，
// notification-setting.vue 保留在目录里但暂不接入这里，等消息通知能力上线后再挂回来。
const userStore = useUserStore();

const tabsValue = ref<string>('basic');

const tabs = ref([
  {
    label: '基本设置',
    value: 'basic',
  },
  {
    label: '修改密码',
    value: 'password',
  },
]);
</script>
<template>
  <Profile
    v-model:model-value="tabsValue"
    title="个人中心"
    :user-info="userStore.userInfo"
    :tabs="tabs"
  >
    <template #content>
      <ProfileBase v-if="tabsValue === 'basic'" />
      <ProfilePasswordSetting v-if="tabsValue === 'password'" />
    </template>
  </Profile>
</template>
