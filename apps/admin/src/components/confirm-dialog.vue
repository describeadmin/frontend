<script lang="ts" setup>
import { ElButton, ElDialog } from 'element-plus';

/**
 * 受控的确认对话框。
 *
 * 不用 `ElMessageBox.confirm`：它由命令式 API 弹出，按钮上挂不了 `data-testid`，
 * 而「没有 data-testid 的交互元素视为未完成」（CLAUDE.md 4.4）——
 * 自动化测试点不到确定按钮，删除类操作就等于没法被端到端验证。
 */
interface Props {
  /** data-testid 前缀，取模块名，如 `dept` → `dept-confirm-btn`。 */
  testid: string;
  title?: string;
  message?: string;
  loading?: boolean;
}

withDefaults(defineProps<Props>(), {
  title: '确认删除',
  message: '删除后该记录将不再出现在列表中，确定继续？',
  loading: false,
});

const visible = defineModel<boolean>({ required: true });

const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="title"
    width="420px"
    append-to-body
    :data-testid="`${testid}-confirm-dialog`"
  >
    <p>{{ message }}</p>
    <template #footer>
      <ElButton :data-testid="`${testid}-cancel-btn`" @click="visible = false">
        取消
      </ElButton>
      <ElButton
        type="danger"
        :loading="loading"
        :data-testid="`${testid}-confirm-btn`"
        @click="emit('confirm')"
      >
        确定
      </ElButton>
    </template>
  </ElDialog>
</template>
