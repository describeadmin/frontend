<script lang="ts" setup>
import { computed, ref } from 'vue';

import { ElAvatar, ElButton, ElMessage } from 'element-plus';

import { compressAvatar } from '../utils/avatar';

defineOptions({ name: 'AvatarPicker' });

const props = withDefaults(
  defineProps<{
    /** 移除头像。 */
    remove: () => Promise<unknown>;
    size?: number;
    /** 头像地址（已经过 `avatarUrl()` 转换），没有头像时传空串。 */
    src?: string;
    /** `data-testid` 前缀，按钮为 `<testid>-avatar-upload-btn` / `<testid>-avatar-remove-btn`。 */
    testid: string;
    /** 没有头像、或图片加载失败时显示的文字，取第一个字符。 */
    text?: string;
    /** 上传：收到的是已经压缩好的文件。抛错即视为失败，由请求层负责提示。 */
    upload: (file: File) => Promise<unknown>;
  }>(),
  { size: 64, src: '', text: '' },
);

const inputRef = ref<HTMLInputElement>();
const busy = ref(false);

const initial = computed(() => props.text.trim().charAt(0).toUpperCase());

function pick() {
  inputRef.value?.click();
}

async function handleChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // 清空，否则连续两次选同一个文件不会触发 change
  input.value = '';
  if (!file) {
    return;
  }
  busy.value = true;
  try {
    let compressed: File;
    try {
      compressed = await compressAvatar(file);
    } catch {
      ElMessage.error('无法识别这张图片，请换一张 PNG / JPEG / WebP 图片');
      return;
    }
    await props.upload(compressed);
    ElMessage.success('头像已更新');
  } catch {
    // 请求层的全局拦截器已经提示过错误信息
  } finally {
    busy.value = false;
  }
}

async function handleRemove() {
  busy.value = true;
  try {
    await props.remove();
    ElMessage.success('头像已移除');
  } catch {
    // 同上
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex items-center gap-4">
    <ElAvatar
      :size="size"
      :src="src || undefined"
      :data-testid="`${testid}-avatar-img`"
    >
      {{ initial }}
    </ElAvatar>
    <div class="flex gap-2">
      <ElButton
        :loading="busy"
        :data-testid="`${testid}-avatar-upload-btn`"
        @click="pick"
      >
        {{ src ? '更换头像' : '上传头像' }}
      </ElButton>
      <ElButton
        v-if="src"
        :disabled="busy"
        :data-testid="`${testid}-avatar-remove-btn`"
        @click="handleRemove"
      >
        移除
      </ElButton>
    </div>
    <!-- 不用 Tailwind 的 hidden：跨包的 Tailwind 类依赖扫描配置，这里没必要冒这个险 -->
    <input
      ref="inputRef"
      type="file"
      accept="image/*"
      style="display: none"
      :data-testid="`${testid}-avatar-input`"
      @change="handleChange"
    />
  </div>
</template>
