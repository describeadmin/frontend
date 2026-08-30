<script lang="ts" setup>
import { useTemplateRef } from 'vue';

import { VbenIconButton } from '@describeadmin/core-shadcn-ui';
import { Settings } from '@describeadmin/icons';

import Preferences from './preferences.vue';

const emit = defineEmits<{ clearPreferencesAndLogout: [] }>();

const refPreferences = useTemplateRef('refPreferences');

function clearPreferencesAndLogout() {
  emit('clearPreferencesAndLogout');
}

function handleOpenPreferences() {
  refPreferences.value?.open();
}
</script>
<template>
  <Preferences
    ref="refPreferences"
    :show-button="false"
    @clear-preferences-and-logout="clearPreferencesAndLogout"
  >
    <VbenIconButton
      class="hover:animate-[shrink_0.3s_ease-in-out]"
      @click="handleOpenPreferences"
    >
      <Settings class="size-4 text-foreground" />
    </VbenIconButton>
  </Preferences>
</template>
