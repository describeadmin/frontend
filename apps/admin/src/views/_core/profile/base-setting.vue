<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, onMounted, ref } from 'vue';

import { useUserStore } from '@describeadmin/stores';
import { AvatarPicker, avatarUrl } from '@describeadmin/system-ui';
import { ProfileBaseSetting, z } from '@describeadmin/ui';

import { ElMessage } from 'element-plus';

import {
  getOwnProfileApi,
  removeOwnAvatarApi,
  updateOwnProfileApi,
  uploadOwnAvatarApi,
} from '#/api';

const profileBaseSettingRef = ref();
const userStore = useUserStore();

const avatarSrc = computed(() => userStore.userInfo?.avatar ?? '');

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

/**
 * 把改动同步进 userStore，顶栏的名字、邮箱、头像立刻跟着变。
 * 刷新页面后由 `/auth/me` 的 profile（实时读库）兜底，不会退回旧值。
 */
function patchUserInfo(patch: {
  avatar?: string;
  email?: string;
  realName?: string;
}) {
  const info = userStore.userInfo;
  if (info) {
    userStore.setUserInfo({ ...info, ...patch });
  }
}

async function handleSubmit(values: Record<string, any>) {
  await updateOwnProfileApi({
    email: values.email,
    mobile: values.mobile,
    nickname: values.nickname,
  });
  patchUserInfo({ email: values.email ?? '', realName: values.nickname });
  ElMessage.success('保存成功');
}

async function uploadAvatar(file: File) {
  patchUserInfo({ avatar: avatarUrl(await uploadOwnAvatarApi(file)) });
}

async function removeAvatar() {
  await removeOwnAvatarApi();
  patchUserInfo({ avatar: '' });
}

onMounted(async () => {
  const data = await getOwnProfileApi();
  profileBaseSettingRef.value.getFormApi().setValues(data);
});
</script>
<template>
  <div class="mb-6">
    <AvatarPicker
      :src="avatarSrc"
      :text="userStore.userInfo?.realName"
      :upload="uploadAvatar"
      :remove="removeAvatar"
      :size="80"
      testid="profile"
    />
  </div>
  <ProfileBaseSetting
    ref="profileBaseSettingRef"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
