<script setup lang="ts">
import type { Recordable } from '@describeadmin/types';

import type { VbenFormSchema } from '@describeadmin/core-form-ui';

import { computed, ref } from 'vue';

import { z } from '@describeadmin/core-form-ui';
import { $t } from '@describeadmin/locales';

import AuthenticationCodeLogin from './code-login.vue';

interface Props {
  /**
   * @zh_CN 是否处于加载处理状态（提交登录中）
   */
  loading?: boolean;
  /**
   * @zh_CN 验证码位数
   */
  codeLength?: number;
  /**
   * @zh_CN 返回按钮跳转的登录页路径
   */
  loginPath?: string;
  /**
   * @zh_CN 发送邮箱验证码。由业务方注入（框架包不持有 requestClient）。
   *
   * 约定对应 framework-auth-email-starter 的 `POST /api/auth/email/code`，
   * 该端点在后端 permit-all 白名单里、无论邮箱是否已注册都返回成功（防账号枚举）——
   * 因此这里只做纯前端的邮箱格式校验，不去猜后端返回值的含义。
   */
  sendCodeApi: (email: string) => Promise<any>;
}

defineOptions({
  name: 'AuthenticationEmailLogin',
});

const props = withDefaults(defineProps<Props>(), {
  codeLength: 6,
  loading: false,
  loginPath: '/auth/login',
});

const emit = defineEmits<{
  /** 提交登录，payload 为 `{ email, code }`，由业务方补 `type: 'email'` 后调后端 */
  submit: [Recordable<any>];
}>();

/** 拿到 AuthenticationCodeLogin 内部的 formApi，供“发送验证码”时读取邮箱字段用。 */
const formRef = ref<{ getFormApi: () => any }>();

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        'data-testid': 'email-login-email-input',
        placeholder: $t('authentication.emailTip'),
      },
      fieldName: 'email',
      label: $t('authentication.email'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.emailTip') })
        .email({ message: $t('authentication.emailValidErrorTip') }),
    },
    {
      component: 'VbenPinInput',
      componentProps: {
        codeLength: props.codeLength,
        'data-testid': 'email-login-code-input',
        createText: (countdown: number) =>
          countdown > 0
            ? $t('authentication.sendText', [countdown])
            : $t('authentication.sendCode'),
        placeholder: $t('authentication.code'),
        /**
         * 发码前先做纯前端的邮箱格式校验，再调业务方注入的接口。
         */
        handleSendCode: async () => {
          const formApi = formRef.value?.getFormApi();
          const { valid } = (await formApi?.validateField('email')) ?? {};
          if (!valid) {
            throw new Error($t('authentication.emailValidErrorTip'));
          }
          const values = await formApi?.getValues();
          await props.sendCodeApi(values?.email);
        },
      },
      fieldName: 'code',
      label: $t('authentication.code'),
      rules: z.string().length(props.codeLength, {
        message: $t('authentication.codeTip', [props.codeLength]),
      }),
    },
  ];
});

function handleSubmit(values: Recordable<any>) {
  emit('submit', values);
}
</script>

<template>
  <AuthenticationCodeLogin
    ref="formRef"
    :form-schema="formSchema"
    :loading="loading"
    :login-path="loginPath"
    :sub-title="$t('authentication.emailLoginSubtitle')"
    @submit="handleSubmit"
  >
    <!-- 覆盖 CodeLogin 默认标题里的 📲（那是短信验证码的语义），换成邮箱图标 -->
    <template #title> {{ $t('authentication.emailLogin') }} 📧 </template>
  </AuthenticationCodeLogin>
</template>
