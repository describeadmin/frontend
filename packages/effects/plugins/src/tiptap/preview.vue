<script setup lang="ts">
/**
 * 富文本预览：`content` 以 `v-html` 原样插入，**不做任何清洗**。
 *
 * ⚠️ 只能用来渲染可信内容。后端存的富文本、用户提交的内容一律先在服务端清洗
 * （白名单标签与属性）再交给这里，否则就是存储型 XSS——脚本在管理后台同源执行，
 * 能直接读到本地存储里的令牌。
 */
import type { TipTapPreviewProps } from './types';

import { computed } from 'vue';

import { cn } from '@describeadmin/core-shared/utils';

import './style.css';
const props = withDefaults(defineProps<TipTapPreviewProps>(), {
  content: '',
  minHeight: 160,
});
const contentMinHeight = computed(() =>
  typeof props.minHeight === 'number'
    ? `${props.minHeight}px`
    : props.minHeight,
);
const previewClass = computed(() =>
  cn(
    'vben-tiptap-content',
    'text-foreground bg-transparent p-0 leading-7',
    props.class,
  ),
);
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->
  <div
    :class="previewClass"
    :style="{ minHeight: contentMinHeight }"
    v-html="content"
  ></div>
</template>
