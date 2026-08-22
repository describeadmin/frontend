<script setup lang="ts">
defineOptions({
  name: 'AuthenticationFormView',
});

defineProps<{
  dataSide?: 'bottom' | 'left' | 'right' | 'top';
}>();
</script>

<template>
  <div
    class="relative flex-col-center bg-background px-6 py-10 lg:flex-initial lg:px-8 dark:bg-background-deep"
  >
    <slot></slot>
    <!-- Router View with Transition and KeepAlive -->
    <RouterView v-slot="{ Component, route }">
      <!--
        docs/LOGIN_MODULE_AUDIT.md A 项排查副产品：mode="out-in" 在"离开的是被
        KeepAlive 缓存的组件、进入的是首次挂载的新组件"这个组合下会卡死——离场
        过渡在等一个不会真正 unmount（只是 deactivate）的节点结束，进场永远等
        不到，最终整段 RouterView 渲染成空注释节点，且没有任何报错/警告。
        本仓在 EmailLogin 路由加入之前，/auth 下从未真的存在第二个有内容的目的
        地（此前的验证码登录等路由都是死壳，从未被点开验证过），这个缺陷因此
        一直潜伏。去掉 out-in、退回同时过渡，用真实点击链路验证过可以正常渲染。
      -->
      <Transition appear name="slide-right">
        <KeepAlive :include="['Login']">
          <component
            :is="Component"
            :key="route.fullPath"
            class="side-content mt-6 w-full sm:mx-auto md:max-w-md"
            :data-side="dataSide"
          />
        </KeepAlive>
      </Transition>
    </RouterView>

    <!-- Footer Copyright -->

    <div
      class="absolute bottom-3 flex text-center text-xs text-muted-foreground"
    >
      <slot name="copyright"> </slot>
    </div>
  </div>
</template>
