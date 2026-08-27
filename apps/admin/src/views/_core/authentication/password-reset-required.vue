<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@describeadmin/constants';
import { resetAllStores, useAccessStore } from '@describeadmin/stores';
import { ProfilePasswordSetting, z } from '@describeadmin/ui';

import { ElMessage } from 'element-plus';

import { changePasswordApi } from '#/api';

defineOptions({ name: 'PasswordResetRequired' });

const router = useRouter();
const accessStore = useAccessStore();

/**
 * 与后端 `DefaultPasswordPolicy` 同口径：至少 8 位，且大写字母/小写字母/数字/特殊字符
 * 四类中至少 3 类。前端只是提前提示，真正的强制校验在后端。
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
      label: '当前密码',
      component: 'VbenInputPassword',
      componentProps: {
        'data-testid': 'auth-pwdreset-oldpwd',
        placeholder: '请输入管理员给你的当前密码',
      },
      rules: z
        .string({ required_error: '请输入当前密码' })
        .min(1, { message: '请输入当前密码' }),
    },
    {
      fieldName: 'newPassword',
      label: '新密码',
      component: 'VbenInputPassword',
      componentProps: {
        'data-testid': 'auth-pwdreset-newpwd',
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
        'data-testid': 'auth-pwdreset-confirm',
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
  // 后端已吊销当前令牌（含本次请求所用的这一个）。直接清本地登录态再跳登录页，
  // 不调用 authStore.logout()——那会再打一次必然 401 的 logoutApi，与内置的 401
  // 自动重认证拦截器抢着 resetAllStores + 跳转，实测会卡住（见 password-setting.vue）。
  accessStore.setAccessToken(null);
  resetAllStores();
  await router.replace(LOGIN_PATH);
}
</script>

<template>
  <div class="mx-auto w-full max-w-md">
    <h2 class="mb-2 text-2xl font-bold" data-testid="auth-pwdreset-title">
      请先修改密码
    </h2>
    <p class="text-muted-foreground mb-6 text-sm">
      你的密码是管理员设置的初始密码，或已超过有效期。修改后才能继续使用系统。
    </p>
    <ProfilePasswordSetting
      class="w-full"
      :form-schema="formSchema"
      @submit="handleSubmit"
    />
  </div>
</template>
