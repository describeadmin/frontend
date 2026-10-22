<script lang="ts" setup>
import { ChevronDown } from '@describeadmin/core-icons';
import { cn } from '@describeadmin/core-shared/utils';

const props = defineProps<{
  class?: string;
}>();

// 控制箭头展开/收起状态
// 显式 <boolean>：Vue 3.5.4x 起按 default 推断字面量类型 false，取反赋值会报类型错
const collapsed = defineModel<boolean>({ default: false });
</script>

<template>
  <div
    :class="cn('vben-link inline-flex items-center', props.class)"
    @click="collapsed = !collapsed"
  >
    <slot :is-expanded="collapsed">
      {{ collapsed }}
      <!-- <span>{{ isExpanded ? '收起' : '展开' }}</span> -->
    </slot>
    <div
      :class="{ 'rotate-180': !collapsed }"
      class="transition-transform duration-300"
    >
      <slot name="icon">
        <ChevronDown class="size-4" />
      </slot>
    </div>
  </div>
</template>
