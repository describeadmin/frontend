<script lang="ts" setup>
import type { Recordable } from '@describeadmin/types';

import { AuthenticationEmailLogin } from '@describeadmin/ui';

import { sendEmailCodeApi } from '#/api';
import { useAuthStore } from '#/store';

defineOptions({ name: 'EmailLogin' });

const authStore = useAuthStore();

/**
 * 邮箱验证码登录——对应后端 `POST /api/auth/login`，`type=email`。
 *
 * 表单、发码节流、校验都在框架组件 `AuthenticationEmailLogin` 里，这里只做两件
 * app 层才有的事：把 app 的 requestClient（`sendEmailCodeApi`）注进去、把提交
 * 结果补上 `type` 交给 authStore。入口的显隐由 login.vue 的 `:providers` 驱动。
 */
function handleLogin(values: Recordable<any>) {
  return authStore.authLogin({ ...values, type: 'email' });
}
</script>

<template>
  <AuthenticationEmailLogin
    :loading="authStore.loginLoading"
    :send-code-api="sendEmailCodeApi"
    @submit="handleLogin"
  />
</template>
