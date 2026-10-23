<script lang="ts" setup>
interface Props {
  companyName?: string;
  companySiteLink?: string;
  date?: string;
  icp?: string;
  icpLink?: string;
}

defineOptions({
  name: 'Copyright',
});

// 不预填任何名字或年份：版权信息归部署方，没填的部分就不显示
withDefaults(defineProps<Props>(), {
  companyName: '',
  companySiteLink: '',
  date: '',
  icp: '',
  icpLink: '',
});
</script>

<template>
  <div class="text-md flex-center">
    <!-- ICP Link -->
    <a
      v-if="icp"
      :href="icpLink || 'javascript:void(0)'"
      class="mx-1 hover:text-primary-hover"
      target="_blank"
    >
      {{ icp }}
    </a>

    <!-- Copyright Text：只填了备案号时不留一个光秃秃的「Copyright ©」 -->
    <template v-if="date || companyName">Copyright © {{ date }}</template>

    <!-- Company Link -->
    <a
      v-if="companyName"
      :href="companySiteLink || 'javascript:void(0)'"
      class="mx-1 hover:text-primary-hover"
      target="_blank"
    >
      {{ companyName }}
    </a>
  </div>
</template>
