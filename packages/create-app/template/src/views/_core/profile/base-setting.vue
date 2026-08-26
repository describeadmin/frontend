<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { onMounted, ref } from 'vue';

import { ProfileBaseSetting, z } from '@describeadmin/ui';

import { ElMessage } from 'element-plus';

import { getOwnProfileApi, updateOwnProfileApi } from '#/api';

const profileBaseSettingRef = ref();

// 用户名/角色不接受在个人中心修改：用户名做只读展示（disabled），角色干脆不放进表单。
const formSchema: VbenFormSchema[] = [
  {
    fieldName: 'username',
    component: 'Input',
    label: '用户名',
    componentProps: {
      disabled: true,
    },
  },
  {
    fieldName: 'nickname',
    component: 'Input',
    label: '姓名',
    rules: z
      .string({ required_error: '请输入姓名' })
      .min(1, { message: '请输入姓名' }),
  },
  {
    fieldName: 'mobile',
    component: 'Input',
    label: '手机号',
    componentProps: {
      placeholder: '请输入手机号',
    },
    rules: z
      .string()
      .optional()
      .refine((value) => !value || /^1[3-9]\d{9}$/.test(value), {
        message: '手机号格式不正确',
      }),
  },
  {
    fieldName: 'email',
    component: 'Input',
    label: '邮箱',
    componentProps: {
      placeholder: '请输入邮箱',
    },
    rules: z
      .string()
      .optional()
      .refine(
        (value) => !value || z.string().email().safeParse(value).success,
        {
          message: '邮箱格式不正确',
        },
      ),
  },
];

async function handleSubmit(values: Record<string, any>) {
  await updateOwnProfileApi({
    email: values.email,
    mobile: values.mobile,
    nickname: values.nickname,
  });
  ElMessage.success('保存成功');
}

onMounted(async () => {
  const data = await getOwnProfileApi();
  profileBaseSettingRef.value.getFormApi().setValues(data);
});
</script>
<template>
  <ProfileBaseSetting
    ref="profileBaseSettingRef"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
