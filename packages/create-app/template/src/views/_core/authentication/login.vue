<script lang="ts" setup>
import type { VbenFormSchema } from '@describeadmin/ui';
import type { PowChallengePayload } from '@describeadmin/utils';

import type { AuthApi } from '#/api';

import { computed, h, onMounted, ref } from 'vue';

import {
  RESULT_CODE_CAPTCHA_INVALID,
  RESULT_CODE_CAPTCHA_REQUIRED,
} from '@describeadmin/constants';
import { $t } from '@describeadmin/locales';
import { AuthenticationLogin, z } from '@describeadmin/ui';
import { solvePow } from '@describeadmin/utils';

import { ElMessage } from 'element-plus';

import { getAuthProvidersApi, getCaptchaApi } from '#/api';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();

/**
 * 后端启用的登录方式，来自 `/api/auth/providers`。
 *
 * **不要把登录方式硬编码在本页面里**——这是插件化在前端侧成立的关键
 * （develop_plan.md 3.2）。原样透传给 <AuthenticationLogin> 的 :providers，
 * 由框架组件按其中是否含 "email" 决定要不要渲染邮箱登录入口——
 * 引入 framework-auth-email-starter 插件后前后端都不用改代码。
 */
const providers = ref<string[]>(['password']);

onMounted(async () => {
  try {
    providers.value = await getAuthProvidersApi();
  } catch {
    // 拿不到就退回内置方式，不要让登录页因为一个辅助接口挂掉而白屏
  }
});

/**
 * 渐进式验证码：正常登录不出现；后端在失败次数达到阈值（同一用户名 / 同一 IP / 全站，
 * 见 describeadmin.security.captcha.*）后返回 CAPTCHA_REQUIRED/CAPTCHA_INVALID，据此才启用，
 * 见 handleSubmit。按挑战的 `type` 分支：
 *
 * - `pow`（后端默认）：不加任何表单字段，提交前浏览器后台求解，用户只多等一下
 * - `image`：显示输入框 + 图片，用户手动输入
 */
const requireCaptcha = ref(false);
const challenge = ref<AuthApi.CaptchaChallenge | null>(null);
/**
 * 当前挑战还没提交过。挑战是一次性的，提交过一次（无论对错）后端就作废，
 * PoW 下一次提交前要重新取题。
 */
let challengeFresh = false;
/** PoW 求解中：按钮 loading + 文案换成「安全校验中」。 */
const verifying = ref(false);

const captchaType = computed(() => challenge.value?.type ?? '');

async function refreshCaptcha() {
  try {
    challenge.value = await getCaptchaApi();
    challengeFresh = true;
  } catch {
    // 拿验证码本身失败不额外处理：图形验证码点图片可重试，PoW 下次提交会重新取题
  }
}

const formSchema = computed((): VbenFormSchema[] => {
  const schema: VbenFormSchema[] = [
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
  if (requireCaptcha.value && captchaType.value === 'image') {
    schema.push({
      component: 'VbenInput',
      componentProps: {
        'data-testid': 'login-captcha-input',
        placeholder: $t('authentication.captchaTip'),
      },
      fieldName: 'captchaCode',
      label: $t('authentication.captcha'),
      rules: z.string().min(1, { message: $t('authentication.captchaTip') }),
      // 验证码图片贴在输入框旁、点击刷新，不依赖 @describeadmin/ui 新增任何插槽——
      // suffix 支持函数返回 VNode（见 form-field.vue 的 VbenRenderContent 用法）
      suffix: () =>
        h('img', {
          'data-testid': 'login-captcha-image',
          class: 'h-9 cursor-pointer rounded border',
          onClick: refreshCaptcha,
          src: challenge.value?.payload?.image ?? '',
          title: $t('authentication.captchaRefreshTip'),
        }),
    });
  }
  return schema;
});

/** 拼出提交体；PoW 模式下先取新题（如需）并求解。 */
async function buildPayload(values: Record<string, any>) {
  // 这张表单固定是用户名+密码，提交类型硬编码为 'password'——用
  // providers.value[0] 当替身是脆弱耦合：一旦 provider 数量超过 1，
  // "排在第一个"不再天然等于"这张表单该提交的类型"，只是恰好因为内置
  // password 的 order() 排最前才凑巧成立
  const payload: Record<string, any> = { ...values, type: 'password' };
  delete payload.captchaCode;
  if (!requireCaptcha.value) {
    return payload;
  }
  if (captchaType.value === 'pow') {
    verifying.value = true;
    try {
      if (!challengeFresh) {
        await refreshCaptcha();
      }
      const current = challenge.value;
      if (current?.type === 'pow') {
        payload.captchaCode = String(
          await solvePow(current.payload as PowChallengePayload),
        );
      }
    } finally {
      verifying.value = false;
    }
  } else if (values.captchaCode !== undefined) {
    payload.captchaCode = values.captchaCode;
  }
  payload.captchaId = challenge.value?.captchaId;
  challengeFresh = false;
  return payload;
}

/**
 * 上游模板在这里放了一个「选择账号」下拉，会把 vben / admin / jack 三个
 * 演示账号连同密码 123456 自动填进表单。已整体移除：那是对着 mock 后端的演示，
 * 保留下去等于在生产登录页上公示测试账号。
 *
 * 上游的滑块验证码也一并移除。它只在浏览器里校验、后端完全不参与，
 * 因此挡不住任何脚本化的暴力破解——真正需要人机验证的场景改用服务端验证码
 * （渐进式触发，见 requireCaptcha），本页面不再有"防不住攻击者、只防得住自己人"的控件。
 */
async function handleSubmit(values: Record<string, any>, retried = false) {
  try {
    await authStore.authLogin(await buildPayload(values));
  } catch (error: any) {
    // RequestClient.request() 在 axios 拦截器链之后又做了一层展开
    // （`throw error.response ? error.response.data : error`，见
    // packages/effects/request/src/request-client/request-client.ts），
    // 因此到这里 error 已经是后端 Result 原始 JSON 本身，不再嵌套 response.data。
    const code = error?.code;
    if (
      code !== RESULT_CODE_CAPTCHA_REQUIRED &&
      code !== RESULT_CODE_CAPTCHA_INVALID
    ) {
      // 其他失败（如密码错误）也消耗了挑战；图形验证码要换一张，否则下次必然"验证码错误"
      if (requireCaptcha.value && captchaType.value === 'image') {
        await refreshCaptcha();
      }
      throw error;
    }
    requireCaptcha.value = true;
    await refreshCaptcha();
    // PoW 用户什么都不用填，没有理由让他再点一次：自动求解重提，每次点击最多一次，防循环
    if (captchaType.value === 'pow' && !retried) {
      return handleSubmit(values, true);
    }
    // "需要验证码"被请求层静默了（见 request.ts），图形验证码这里自己提示一句
    if (code === RESULT_CODE_CAPTCHA_REQUIRED) {
      ElMessage.warning($t('authentication.captchaTip'));
    }
    throw error;
  }
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
    :loading="authStore.loginLoading || verifying"
    :providers="providers"
    :show-code-login="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-third-party-login="false"
    :show-forget-password="false"
    :submit-button-text="verifying ? $t('authentication.captchaVerifying') : ''"
    @submit="(values) => handleSubmit(values)"
  />
</template>
