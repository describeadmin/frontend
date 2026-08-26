<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@describeadmin/constants';
import { resetAllStores, useAccessStore } from '@describeadmin/stores';
import { ProfilePasswordSetting, z } from '@describeadmin/ui';

import { ElMessage } from 'element-plus';

import { changePasswordApi } from '#/api';

const router = useRouter();
const accessStore = useAccessStore();

/**
 * 与后端 `DefaultPasswordPolicy` 保持一致的口径：至少 8 位，且大写字母/小写字母/
 * 数字/特殊字符四类中至少覆盖 3 类。这里只是提前给出输入提示，真正的强制校验在后端，
 * 不能因为前端放行就认为一定合规——服务端仍会用同一套规则再校验一遍。
 */
function isPasswordCompliant(value: string): boolean {
  if (value.length < 8) {
    return false;
  }
  let classes = 0;
  if (/[a-z]/.test(value)) classes++;
  if (/[A-Z]/.test(value)) classes++;
  if (/\d/.test(value)) classes++;
  if (/[^A-Za-z0-9]/.test(value)) classes++;
  return classes >= 3;
}

const PASSWORD_POLICY_MESSAGE =
  '密码至少8位，且需同时包含大写字母、小写字母、数字、特殊字符中的至少3类';

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'oldPassword',
      label: '旧密码',
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: '请输入旧密码',
      },
      rules: z
        .string({ required_error: '请输入旧密码' })
        .min(1, { message: '请输入旧密码' }),
    },
    {
      fieldName: 'newPassword',
      label: '新密码',
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: '请输入新密码',
      },
      rules: z
        .string({ required_error: '请输入新密码' })
        .min(1, { message: '请输入新密码' })
        .refine(isPasswordCompliant, { message: PASSWORD_POLICY_MESSAGE }),
    },
    {
      fieldName: 'confirmPassword',
      label: '确认密码',
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: '请再次输入新密码',
      },
      dependencies: {
        rules(values) {
          const { newPassword } = values;
          return z
            .string({ required_error: '请再次输入新密码' })
            .min(1, { message: '请再次输入新密码' })
            .refine((value) => value === newPassword, {
              message: '两次输入的密码不一致',
            });
        },
        triggerFields: ['newPassword'],
      },
    },
  ];
});

async function handleSubmit(values: Record<string, any>) {
  await changePasswordApi(values.oldPassword, values.newPassword);
  ElMessage.success('密码修改成功，请使用新密码重新登录');
  // 改密成功后后端已经吊销了当前令牌（含发起本次请求所用的这一个），这里直接清本地
  // 登录态并跳转登录页，不调用 authStore.logout()（它内部会再打一次 logoutApi()）——
  // 那个令牌已经失效，这一请求必然 401，还会跟框架内置的 401 自动重新认证拦截器
  // （request.ts 的 authenticateResponseInterceptor）抢着处理同一件事：两边并发
  // resetAllStores + 跳转，互相打断，实测会卡在原地不跳转，而不是报错更明显的失败。
  accessStore.setAccessToken(null);
  resetAllStores();
  await router.replace(LOGIN_PATH);
}
</script>
<template>
  <ProfilePasswordSetting
    class="w-full max-w-lg"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
