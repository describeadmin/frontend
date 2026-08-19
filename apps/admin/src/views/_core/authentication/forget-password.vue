<script lang="ts" setup>
import type { Recordable } from '@describeadmin/types';
import type { VbenFormSchema } from '@describeadmin/ui';

import { computed, ref } from 'vue';

import { $t } from '@describeadmin/locales';
import { AuthenticationForgetPassword, z } from '@describeadmin/ui';

defineOptions({ name: 'ForgetPassword' });

const loading = ref(false);

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: 'example@example.com',
      },
      fieldName: 'email',
      label: $t('authentication.email'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.emailTip') })
        .email($t('authentication.emailValidErrorTip')),
    },
  ];
});

function handleSubmit(value: Recordable<any>) {
  void value;
}
</script>

<template>
  <AuthenticationForgetPassword
    :form-schema="formSchema"
    :loading="loading"
    @submit="handleSubmit"
  />
</template>
