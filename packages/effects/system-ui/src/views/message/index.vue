<script lang="ts" setup>
import type { SysMessage } from '../../api';

import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { ConfirmDialog } from '@describeadmin/ele-ui';
import { Page } from '@describeadmin/ui';

import {
  ElButton,
  ElMessage,
  ElOption,
  ElPagination,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import {
  clearReadMessagesApi,
  deleteMessageApi,
  getMessageListApi,
  readAllMessagesApi,
  readMessageApi,
} from '../../api';
import {
  loadMessageCategoryLabels,
  messageCategoryLabel,
  messageCategoryOptions,
  notifyInboxChanged,
  openMessageLink,
} from '../../composables/useMessageInbox';
import { relativeTime } from '../../utils/relative-time';

defineOptions({ name: 'MessageCenter' });

/**
 * 消息中心：当前登录用户的全部站内信。
 *
 * 所有用户都有、不逐角色授权，所以是前端本地静态路由（`core.ts` 的 `Root.children`），
 * 不进 `sys_menu`，也就没有按钮级权限可判——接口本身只允许操作自己的消息。
 */
const router = useRouter();

const loading = ref(false);
const rows = ref<SysMessage[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });
const filter = reactive<{ category: string; scope: 'all' | 'unread' }>({
  category: '',
  scope: 'all',
});

const submitting = ref(false);
const confirmVisible = ref(false);
const deletingId = ref<null | string>(null);
const clearConfirmVisible = ref(false);

async function load() {
  loading.value = true;
  try {
    const result = await getMessageListApi({
      ...page,
      category: filter.category || undefined,
      unread: filter.scope === 'unread' || undefined,
    });
    rows.value = result.records;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

async function reload() {
  page.current = 1;
  await load();
}

async function afterChange() {
  notifyInboxChanged();
  await load();
}

async function markRead(row: SysMessage) {
  await readMessageApi(row.id);
  await afterChange();
}

async function openRow(row: SysMessage) {
  if (!row.readTime) {
    await readMessageApi(row.id);
    notifyInboxChanged();
  }
  const navigated = await openMessageLink(router, row.link);
  if (!navigated) {
    await load();
  }
}

async function readAll() {
  const count = await readAllMessagesApi();
  ElMessage.success(count > 0 ? `已将 ${count} 条标为已读` : '没有未读消息');
  await afterChange();
}

function askDelete(row: SysMessage) {
  deletingId.value = row.id;
  confirmVisible.value = true;
}

async function confirmDelete() {
  if (deletingId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    await deleteMessageApi(deletingId.value);
    ElMessage.success('删除成功');
    confirmVisible.value = false;
    await afterChange();
  } finally {
    submitting.value = false;
  }
}

async function confirmClear() {
  submitting.value = true;
  try {
    const count = await clearReadMessagesApi();
    ElMessage.success(`已清空 ${count} 条已读消息`);
    clearConfirmVisible.value = false;
    page.current = 1;
    await afterChange();
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadMessageCategoryLabels(), load()]);
  } catch {
    // 已经由请求层的全局拦截器处理，这里只避免异常冒泡成 Vue 的未处理错误
  }
});
</script>

<template>
  <Page title="消息中心">
    <template #extra>
      <ElButton data-testid="message-read-all-btn" @click="readAll">
        全部已读
      </ElButton>
      <ElButton
        type="danger"
        plain
        data-testid="message-clear-read-btn"
        @click="clearConfirmVisible = true"
      >
        清空已读
      </ElButton>
    </template>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <ElRadioGroup
        v-model="filter.scope"
        data-testid="message-scope-radio"
        @change="reload"
      >
        <ElRadioButton value="all" data-testid="message-scope-all">
          全部
        </ElRadioButton>
        <ElRadioButton value="unread" data-testid="message-scope-unread">
          未读
        </ElRadioButton>
      </ElRadioGroup>
      <!-- 候选取自字典；没登记的分类可直接输入编码筛选（allow-create） -->
      <ElSelect
        v-model="filter.category"
        class="!w-56"
        clearable
        filterable
        allow-create
        placeholder="全部分类"
        data-testid="message-category-select"
        @change="reload"
      >
        <ElOption
          v-for="option in messageCategoryOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </ElSelect>
    </div>

    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="id"
      data-testid="message-table"
      :row-class-name="() => 'cursor-pointer'"
      @row-click="openRow"
    >
      <ElTableColumn label="" width="36">
        <template #default="{ row }">
          <span
            v-if="!row.readTime"
            class="inline-block size-2 rounded-sm bg-primary"
            data-testid="message-unread-dot"
          ></span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="消息" min-width="320">
        <template #default="{ row }">
          <div data-testid="message-row">
            <div :class="row.readTime ? '' : 'font-semibold'">
              {{ row.title }}
            </div>
            <div
              v-if="row.content"
              class="mt-1 line-clamp-2 text-xs text-muted-foreground"
            >
              {{ row.content }}
            </div>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="分类" min-width="120">
        <template #default="{ row }">
          <ElTag type="info" disable-transitions>
            {{ messageCategoryLabel(row.category) }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="发送人" min-width="120">
        <template #default="{ row }">
          {{ row.senderName || (row.senderId ? '—' : '系统') }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="时间" min-width="140">
        <template #default="{ row }">
          <span :title="row.createTime">{{
            relativeTime(row.createTime)
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-if="!row.readTime"
            link
            type="primary"
            data-testid="message-read-btn"
            @click.stop="markRead(row)"
          >
            标为已读
          </ElButton>
          <ElButton
            link
            type="danger"
            data-testid="message-delete-btn"
            @click.stop="askDelete(row)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="mt-4 flex justify-end">
      <ElPagination
        v-model:current-page="page.current"
        v-model:page-size="page.size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        data-testid="message-pagination"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <ConfirmDialog
      v-model="confirmVisible"
      testid="message"
      :loading="submitting"
      @confirm="confirmDelete"
    />

    <ConfirmDialog
      v-model="clearConfirmVisible"
      testid="message-clear"
      :loading="submitting"
      message="将删除全部已读消息，未读消息保留。删除后不可恢复，确定继续？"
      @confirm="confirmClear"
    />
  </Page>
</template>
