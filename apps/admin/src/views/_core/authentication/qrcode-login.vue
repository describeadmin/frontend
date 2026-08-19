<script lang="ts" setup>
import { AuthenticationQrCodeLogin } from '@describeadmin/ui';
import { LOGIN_PATH } from '@describeadmin/constants';

defineOptions({ name: 'QrCodeLogin' });
</script>

<template>
  <AuthenticationQrCodeLogin :login-path="LOGIN_PATH" />
</template>
