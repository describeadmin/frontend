<script setup lang="ts">
import type { Recordable } from '@describeadmin/types';

import type { VbenFormSchema } from '@describeadmin/core-form-ui';

import { computed, reactive, watch } from 'vue';

import { useVbenForm } from '@describeadmin/core-form-ui';
import { VbenButton } from '@describeadmin/core-shadcn-ui';
import { $t } from '@describeadmin/locales';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

interface Props {
  formSchema?: VbenFormSchema[];
}

const props = withDefaults(defineProps<Props>(), {
  formSchema: () => [],
});

const emit = defineEmits<{
  submit: [Recordable<any>];
}>();

const [Form, formApi] = useVbenForm(
  reactive({
    commonConfig: {
      // labelWidth 只在 layout 为 horizontal 时生效（isVertical 为 true 时
      // form-field.vue 直接忽略它），窄屏切到 vertical 后这个值天然不起作用，
      // 不需要跟着 layout 一起切换。
      labelWidth: 130,
      // 所有表单项
      componentProps: {
        class: 'w-full',
      },
    },
    layout: 'horizontal',
    schema: computed(() => props.formSchema),
    showDefaultActions: false,
  }),
);

// 旧密码/新密码/确认密码三项 + 密码强度提示、明文切换按钮，横向布局（label 130px
// 定宽 + 输入框）在窄屏（含被压缩的 PC 窗口）下会把输入框挤得很窄。用与
// modal/drawer 相同的断点判断，窄屏改用 vertical（label 在输入框上方），
// 宽屏保持原有的横向对齐。
const breakpoints = useBreakpoints(breakpointsTailwind);
const isNarrow = breakpoints.smaller('md');

watch(
  isNarrow,
  (narrow) => {
    formApi.setState({ layout: narrow ? 'vertical' : 'horizontal' });
  },
  { immediate: true },
);

async function handleSubmit() {
  const { valid } = await formApi.validate();
  const values = await formApi.getValues();
  if (valid) {
    emit('submit', values);
  }
}

defineExpose({
  getFormApi: () => formApi,
});
</script>
<template>
  <div>
    <Form />
    <VbenButton type="submit" class="mt-4" @click="handleSubmit">
      {{ $t('profile.updatePassword') }}
    </VbenButton>
  </div>
</template>
