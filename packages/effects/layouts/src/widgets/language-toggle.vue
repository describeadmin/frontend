<script setup lang="ts">
import type { SupportedLanguagesType } from '@describeadmin/locales';

import { SUPPORT_LANGUAGES } from '@describeadmin/constants';
import {
  VbenDropdownRadioMenu,
  VbenIconButton,
} from '@describeadmin/core-shadcn-ui';
import { Languages } from '@describeadmin/icons';
import { loadLocaleMessages } from '@describeadmin/locales';
import { preferences, updatePreferences } from '@describeadmin/preferences';

defineOptions({
  name: 'LanguageToggle',
});

async function handleUpdate(value: string | undefined) {
  if (!value) return;
  const locale = value as SupportedLanguagesType;
  updatePreferences({
    app: {
      locale,
    },
  });
  await loadLocaleMessages(locale);
}
</script>

<template>
  <div>
    <VbenDropdownRadioMenu
      :menus="SUPPORT_LANGUAGES"
      :model-value="preferences.app.locale"
      @update:model-value="handleUpdate"
    >
      <VbenIconButton class="hover:animate-[shrink_0.3s_ease-in-out]">
        <Languages class="size-4 text-foreground" />
      </VbenIconButton>
    </VbenDropdownRadioMenu>
  </div>
</template>
