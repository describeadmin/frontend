<script lang="ts" setup>
import { VbenIconButton } from '@describeadmin/core-shadcn-ui';
import { Settings } from '@describeadmin/icons';

import Preferences from './preferences.vue';

const emit = defineEmits<{ clearPreferencesAndLogout: [] }>();

function clearPreferencesAndLogout() {
  emit('clearPreferencesAndLogout');
}
</script>
<template>
  <Preferences @clear-preferences-and-logout="clearPreferencesAndLogout">
    <VbenIconButton class="hover:animate-[shrink_0.3s_ease-in-out]">
      <Settings class="size-4 text-foreground" />
    </VbenIconButton>
  </Preferences>
</template>
