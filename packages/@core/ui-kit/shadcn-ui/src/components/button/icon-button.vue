<script setup lang="ts">
import type { ButtonVariants } from '../../ui';
import type { VbenButtonProps } from './button';

import { computed, useSlots } from 'vue';

import { cn } from '@describeadmin/core-shared/utils';

import { VbenTooltip } from '../tooltip';
import VbenButton from './button.vue';

interface Props extends VbenButtonProps {
  class?: any;
  disabled?: boolean;
  onClick?: () => void;
  tooltip?: string;
  tooltipDelayDuration?: number;
  tooltipSide?: 'bottom' | 'left' | 'right' | 'top';
  variant?: ButtonVariants;
}

// 带 tooltip 时根节点是 VbenTooltip（不渲染自己的 DOM），透传属性会落空——
// data-testid 之类的就丢了。统一手动绑到真正的按钮上，两个分支行为一致。
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  onClick: () => {},
  tooltipDelayDuration: 200,
  tooltipSide: 'bottom',
  variant: 'icon',
});

const slots = useSlots();

const showTooltip = computed(() => !!slots.tooltip || !!props.tooltip);
</script>

<template>
  <VbenButton
    v-if="!showTooltip"
    v-bind="$attrs"
    :class="cn('rounded-full', props.class)"
    :disabled="disabled"
    :variant="variant"
    size="icon"
    @click="onClick"
  >
    <slot></slot>
  </VbenButton>

  <VbenTooltip
    v-else
    :delay-duration="tooltipDelayDuration"
    :side="tooltipSide"
  >
    <template #trigger>
      <VbenButton
        v-bind="$attrs"
        :class="cn('rounded-full', props.class)"
        :disabled="disabled"
        :variant="variant"
        size="icon"
        @click="onClick"
      >
        <slot></slot>
      </VbenButton>
    </template>
    <slot v-if="slots.tooltip" name="tooltip"> </slot>
    <template v-else>
      {{ tooltip }}
    </template>
  </VbenTooltip>
</template>
