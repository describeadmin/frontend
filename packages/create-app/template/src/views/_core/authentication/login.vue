<script lang="ts" setup>
import type { VbenFormSchema } from '@describeadmin/ui';

import { computed, onMounted, ref } from 'vue';

import { $t } from '@describeadmin/locales';
import { AuthenticationLogin, z } from '@describeadmin/ui';

import { getAuthProvidersApi } from '#/api';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();

/**
 * 后端启用的登录方式，来自 `/api/auth/providers`。
 *
 * **不要把登录方式硬编码在本页面里**——这是插件化在前端侧成立的关键
 * （develop_plan.md 3.2）。引入 framework-auth-zhengwuding-starter 后
 * 这里会自动多出一项，前后端都不需要改代码。
 *
 * 目前框架只内置 password 一种，因此暂时只渲染用户名密码表单；
 * 出现第二种方式时，在这里按 providers 渲染切换入口即可。
 */
const providers = ref<string[]>(['password']);

onMounted(async () => {
  try {
    providers.value = await getAuthProvidersApi();
  } catch {
    // 拿不到就退回内置方式，不要让登录页因为一个辅助接口挂掉而白屏
  }
});

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        'data-testid': 'login-username-input',
        placeholder: $t('authentication.usernameTip'),
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        'data-testid': 'login-password-input',
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
  ];
});

/**
 * 上游模板在这里放了一个「选择账号」下拉，会把 vben / admin / jack 三个
 * 演示账号连同密码 123456 自动填进表单。已整体移除：那是对着 mock 后端的演示，
 * 保留下去等于在生产登录页上公示测试账号。
 *
 * 上游的滑块验证码也一并移除。它只在浏览器里校验、后端完全不参与，
 * 因此挡不住任何脚本化的暴力破解——真正需要人机验证时必须做成服务端校验。
 * 而它确实会挡住 AI 的端到端自测（develop_plan.md 目标 #3）。
 * 用一个防不住攻击者、只防得住自己人的控件，是净损失。
 */
function handleSubmit(values: Record<string, any>) {
  return authStore.authLogin({ ...values, type: providers.value[0] });
}
</script>

<template>
  <!--
    docs/LOGIN_MODULE_AUDIT.md A 项：手机验证码登录/二维码登录/注册/忘记密码/第三方登录
    目前都没有对应的后端能力（后端只有 password 一种内置方式），上游模板默认全部打开，
    留下的是"看起来能点、点了什么都不会发生"的死壳。这里显式关闭，对应的
    app 级包装页（code-login.vue、qrcode-login.vue、register.vue、forget-password.vue）
    与它们的路由已一并删除，而不是只隐藏入口——直接访问 URL 仍然能看到空白页面
    同样算"死壳"。
  -->
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-third-party-login="false"
    :show-forget-password="false"
    @submit="handleSubmit"
  />
</template>
