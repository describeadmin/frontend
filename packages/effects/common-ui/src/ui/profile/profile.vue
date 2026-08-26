<script setup lang="ts">
import type { Props } from './types';

import { preferences } from '@describeadmin/core-preferences';
import {
  Card,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  VbenAvatar,
} from '@describeadmin/core-shadcn-ui';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

import { Page } from '../../components';

defineOptions({
  name: 'ProfileUI',
});

withDefaults(defineProps<Props>(), {
  title: '关于项目',
  tabs: () => [],
});

const tabsValue = defineModel<string>('modelValue');

// 侧边栏与 tabs 在窄屏下改为顶部横向排布（见 template 里的 lg 断点），
// 这里同步切换 Tabs 的方向语义，避免横向排布时键盘方向键仍按纵向 tablist 处理。
const breakpoints = useBreakpoints(breakpointsTailwind);
const isNarrow = breakpoints.smaller('lg');
</script>
<template>
  <Page auto-content-height>
    <div class="flex size-full flex-col gap-4 lg:flex-row lg:gap-0">
      <Card class="w-full flex-none lg:w-1/5 xl:w-1/6">
        <div class="mt-4 flex-col-center h-40 gap-4">
          <VbenAvatar
            :src="userInfo?.avatar ?? preferences.app.defaultAvatar"
            class="size-20"
          />
          <span class="text-lg font-semibold">
            {{ userInfo?.realName ?? '' }}
          </span>
          <span class="text-sm text-foreground/80">
            {{ userInfo?.username ?? '' }}
          </span>
        </div>
        <Separator class="my-4" />
        <Tabs
          v-model="tabsValue"
          :orientation="isNarrow ? 'horizontal' : 'vertical'"
          class="m-4"
        >
          <TabsList class="grid w-full grid-cols-2 bg-card lg:grid-cols-1">
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.value"
              :value="tab.value"
              class="h-12 justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>
      <Card class="w-full flex-auto p-4 sm:p-8 lg:ml-4 lg:w-4/5 xl:w-5/6">
        <slot name="content"></slot>
      </Card>
    </div>
  </Page>
</template>
