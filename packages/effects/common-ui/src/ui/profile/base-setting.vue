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

// 窄屏（含被压缩的 PC 窗口）下 label 与输入框并排会挤压输入框，
// 改用 vertical（label 在上）；宽屏维持原有横向对齐。见 password-setting.vue 同款处理。
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
  <div @keydown.enter.prevent="handleSubmit">
    <Form />
    <VbenButton type="submit" class="mt-4" @click="handleSubmit">
      {{ $t('profile.updateBasicProfile') }}
    </VbenButton>
  </div>
</template>
