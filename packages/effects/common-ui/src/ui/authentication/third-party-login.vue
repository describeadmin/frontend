<script setup lang="ts">
import { useAppConfig } from '@describeadmin/hooks';
import { $t } from '@describeadmin/locales';

import DingdingLogin from './dingding-login.vue';

defineOptions({
  name: 'ThirdPartyLogin',
});

const {
  auth: { dingding: dingdingAuthConfig },
} = useAppConfig(import.meta.env, import.meta.env.PROD);
</script>

<template>
  <!--
    docs/LOGIN_MODULE_AUDIT.md A 项：原来这里还有微信/QQ/GitHub/Google 四个图标按钮，
    没有任何 @click 处理、纯装饰，已删除——不是本项目场景需要的社交登录，
    留着只是"看起来能点、其实什么都不做"的死壳。

    DingdingLogin 予以保留：阶段 G（浙政钉/钉钉登录插件）尚未开工前，
    dingdingAuthConfig 恒为空（没有任何 app 配置过对应环境变量），本组件因此恒为空渲染，
    不算"半成品功能已暴露给用户"。它不违反 CLAUDE.md §4.6"核心不能出现厂商名字"——
    那条规则约束的是后端 Java SPI，不约束前端 UI 组件库。
  -->
  <div v-if="dingdingAuthConfig" class="w-full sm:mx-auto md:max-w-md">
    <div class="mt-4 flex items-center justify-between">
      <span class="w-[35%] border-b border-input dark:border-gray-600"></span>
      <span class="text-center text-xs text-muted-foreground uppercase">
        {{ $t('authentication.thirdPartyLogin') }}
      </span>
      <span class="w-[35%] border-b border-input dark:border-gray-600"></span>
    </div>

    <div class="mt-4 flex flex-wrap justify-center">
      <DingdingLogin
        :corp-id="dingdingAuthConfig.corpId"
        :client-id="dingdingAuthConfig.clientId"
        class="mb-3"
      />
    </div>
  </div>
</template>
