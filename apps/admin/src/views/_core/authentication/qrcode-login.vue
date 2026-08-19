<script lang="ts" setup>
import { LOGIN_PATH } from '@describeadmin/constants';
import { AuthenticationQrCodeLogin } from '@describeadmin/ui';

defineOptions({ name: 'QrCodeLogin' });
</script>

<template>
  <AuthenticationQrCodeLogin :login-path="LOGIN_PATH" />
</template>
