<script setup lang="ts">
import type { IconPickerProps } from './types';

import { computed, ref, useAttrs, watch, watchEffect } from 'vue';

import {
  Button,
  Input,
  Pagination,
  PaginationEllipsis,
  PaginationFirst,
  PaginationLast,
  PaginationList,
  PaginationListItem,
  PaginationNext,
  PaginationPrev,
  VbenIcon,
  VbenIconButton,
  VbenPopover,
} from '@describeadmin/core-shadcn-ui';
import { isFunction } from '@describeadmin/core-shared/utils';
import { usePagination } from '@describeadmin/hooks';
import { EmptyIcon, Grip, listIcons, LoaderCircle } from '@describeadmin/icons';
import { $t } from '@describeadmin/locales';

import { objectOmit, refDebounced, watchDebounced } from '@vueuse/core';

import { fetchIconsData } from './icons';

/**
 * 根节点是 VbenPopover（本身没有可挂载的 DOM 元素），attr 全都在下面的
 * getBindAttrs / $attrs 里显式绑定，落在触发器上。不关掉自动透传的话，
 * 从外面传 data-testid 这类 attr 会触发 Vue 的 "Extraneous non-props attributes" 警告。
 */
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<IconPickerProps>(), {
  prefix: 'ant-design',
  pageSize: 36,
  icons: () => [],
  iconSlot: 'default',
  iconClass: 'size-4',
  autoFetchApi: true,
  modelValueProp: 'modelValue',
  inputComponent: undefined,
  type: 'input',
  contentClass: 'p-0 pt-3 w-full',
  zIndex: undefined,
  clearable: false,
});

const emit = defineEmits<{
  change: [string];
}>();

const attrs = useAttrs();

const modelValue = defineModel({ default: '', type: String });

const visible = ref(false);
const currentSelect = ref('');
const keyword = ref('');
const keywordDebounce = refDebounced(keyword, 300);
const innerIcons = ref<string[]>([]);
const loading = ref(false);
const loadFailed = ref(false);

/**
 * 拉取图标集清单。
 *
 * 单独抽出来是为了让「重试」复用同一条路径：fetchIconsData 只在成功时留缓存，
 * 失败时会把在途请求摘掉，所以这里再调一次就是真的重新发请求。
 */
async function loadIcons(prefix: string) {
  if (!prefix || prefix === 'svg' || !props.autoFetchApi) {
    return;
  }
  loading.value = true;
  loadFailed.value = false;
  try {
    innerIcons.value = await fetchIconsData(prefix);
  } catch {
    // 具体错误已由 fetchIconsData 打到控制台，这里只把它翻译成界面上可见的
    // 「加载失败 + 重试」——不能像以前那样只留一个「暂无数据」，那和真的没有
    // 匹配项长得一模一样，用户会以为图标集里就没有这个图标。
    loadFailed.value = true;
    innerIcons.value = [];
  } finally {
    loading.value = false;
  }
}

watchDebounced(
  () => props.prefix,
  (prefix) => void loadIcons(prefix),
  {
    immediate: true,
    debounce: 500,
    maxWait: 1000,
  },
);

const currentList = computed(() => {
  try {
    if (props.prefix) {
      if (
        props.prefix !== 'svg' &&
        props.autoFetchApi &&
        props.icons.length === 0
      ) {
        return innerIcons.value;
      }
      const icons = listIcons('', props.prefix);
      if (icons.length === 0) {
        console.warn(`No icons found for prefix: ${props.prefix}`);
      }
      return icons;
    } else {
      return props.icons;
    }
  } catch (error) {
    console.error('Failed to load icons:', error);
    return [];
  }
});

const showList = computed(() => {
  return currentList.value.filter((item) =>
    item.includes(keywordDebounce.value),
  );
});

/**
 * 当前值不在候选清单里：存量脏数据，或换过图标集之后对不上的老值。
 *
 * 加载中 / 加载失败时不提示——那两种情况下清单本身就不完整，说「不在列表中」
 * 是误报。
 */
const currentNotInList = computed(() => {
  if (!currentSelect.value || loading.value || loadFailed.value) {
    return false;
  }
  return !currentList.value.includes(currentSelect.value);
});

const { paginationList, total, setCurrentPage, currentPage } = usePagination(
  showList,
  props.pageSize,
);

watchEffect(() => {
  currentSelect.value = modelValue.value;
});

watch(
  () => currentSelect.value,
  (v) => {
    emit('change', v);
  },
);

const handleClick = (icon: string) => {
  currentSelect.value = icon;
  modelValue.value = icon;
  close();
};

/** 与 handleClick 一样直接写 modelValue，由 defineModel 负责把变更抛给上层。 */
function clear() {
  currentSelect.value = '';
  modelValue.value = '';
  close();
}

const handlePageChange = (page: number) => {
  setCurrentPage(page);
};

function toggleOpenState() {
  visible.value = !visible.value;
}

function open() {
  visible.value = true;
}

function close() {
  visible.value = false;
}

function onKeywordChange(v: string) {
  keyword.value = v;
}

const searchInputProps = computed(() => {
  return {
    placeholder: $t('ui.iconPicker.search'),
    [props.modelValueProp]: keyword.value,
    [`onUpdate:${props.modelValueProp}`]: onKeywordChange,
    class: 'mx-2',
  };
});

function updateCurrentSelect(v: string) {
  currentSelect.value = v;
  if (props.modelValueProp === 'modelValue') {
    modelValue.value = v;
  }
  const eventKey = `onUpdate:${props.modelValueProp}`;
  if (attrs[eventKey] && isFunction(attrs[eventKey])) {
    attrs[eventKey](v);
  }
}
const getBindAttrs = computed(() => {
  return objectOmit(attrs, [`onUpdate:${props.modelValueProp}`]);
});

/**
 * 浮层面板的属性。zIndex 走内联样式下发给内容元素，reka-ui 会读取它的
 * computed z-index 并应用到定位容器上——内联样式是唯一能同时压过 `.z-popup`
 * （未分层的 `z-index: var(--popup-z-index)`）和 el-overlay 的手段，用 Tailwind 类
 * 还得依赖 `!` 前缀与扫描范围，不如内联样式确定。
 */
const panelProps = computed(() => ({
  align: 'end' as const,
  alignOffset: -11,
  sideOffset: 8,
  ...(props.zIndex === undefined ? {} : { style: { zIndex: props.zIndex } }),
}));

defineExpose({ toggleOpenState, open, close });
</script>
<template>
  <VbenPopover
    v-model:open="visible"
    :content-props="panelProps"
    :content-class="contentClass"
    trigger-class="w-full"
  >
    <template #trigger>
      <template v-if="props.type === 'input'">
        <component
          v-if="props.inputComponent"
          :is="inputComponent"
          :[modelValueProp]="currentSelect"
          :placeholder="$t('ui.iconPicker.placeholder')"
          role="combobox"
          :aria-label="$t('ui.iconPicker.placeholder')"
          :aria-expanded="visible"
          :[`onUpdate:${modelValueProp}`]="updateCurrentSelect"
          v-bind="getBindAttrs"
        >
          <template #[iconSlot]>
            <VbenIcon
              :icon="currentSelect || Grip"
              class="size-4"
              aria-hidden="true"
            />
          </template>
        </component>
        <div class="relative w-full" v-else>
          <Input
            v-bind="$attrs"
            v-model="currentSelect"
            :placeholder="$t('ui.iconPicker.placeholder')"
            class="h-8 w-full pr-8"
            role="combobox"
            :aria-label="$t('ui.iconPicker.placeholder')"
            :aria-expanded="visible"
          />
          <VbenIcon
            :icon="currentSelect || Grip"
            class="absolute top-1 right-1 size-6"
            aria-hidden="true"
          />
        </div>
      </template>
      <VbenIcon
        :icon="currentSelect || Grip"
        v-else
        class="size-4"
        v-bind="$attrs"
      />
    </template>
    <div
      v-if="currentNotInList || (clearable && currentSelect)"
      class="mb-2 flex items-center justify-between gap-2 px-2"
    >
      <span v-if="currentNotInList" class="text-destructive text-xs">
        {{ $t('ui.iconPicker.notInSet') }}
      </span>
      <span v-else></span>
      <!-- 清空入口放在面板里而不是触发器上：Element Plus 的 clearable 在 readonly
           下不渲染清除按钮，而触发器恰恰要 readonly 才能挡住手输。 -->
      <Button
        v-if="clearable && currentSelect"
        data-testid="icon-picker-clear-btn"
        size="sm"
        variant="ghost"
        @click="clear"
      >
        {{ $t('ui.iconPicker.clear') }}
      </Button>
    </div>

    <div class="mb-2 flex w-full">
      <component
        v-if="inputComponent"
        :is="inputComponent"
        v-bind="searchInputProps"
      />
      <Input
        v-else
        class="mx-2 h-8 w-full"
        :placeholder="$t('ui.iconPicker.search')"
        v-model="keyword"
      />
    </div>

    <template v-if="paginationList.length > 0">
      <div class="grid max-h-90 w-full grid-cols-6 justify-items-center">
        <VbenIconButton
          v-for="(item, index) in paginationList"
          :key="index"
          :tooltip="item"
          tooltip-side="top"
          @click="handleClick(item)"
        >
          <!-- testid 挂在 svg 外层而不是 VbenIconButton 上：它在带 tooltip 时
               并不透传 attr 到真实按钮，挂在按钮上等于没有。带上图标名，
               自动化才能精确点到某一个图标。 -->
          <span :data-testid="`icon-picker-item-${item}`" class="inline-flex">
            <VbenIcon
              :class="{
                'text-primary transition-all': currentSelect === item,
              }"
              :icon="item"
            />
          </span>
        </VbenIconButton>
      </div>
      <div
        v-if="total >= pageSize"
        class="flex-center flex justify-end overflow-hidden border-t py-2 pr-3"
      >
        <Pagination
          :items-per-page="pageSize"
          :sibling-count="1"
          :total="total"
          show-edges
          size="small"
          @update:page="handlePageChange"
        >
          <PaginationList
            v-slot="{ items }"
            class="flex w-full items-center gap-1"
          >
            <PaginationFirst class="size-5" />
            <PaginationPrev class="size-5" />
            <template v-for="(item, index) in items">
              <PaginationListItem
                v-if="item.type === 'page'"
                :key="index"
                :value="item.value"
                as-child
              >
                <Button
                  :variant="item.value === currentPage ? 'default' : 'outline'"
                  class="size-5 p-0 text-sm"
                >
                  {{ item.value }}
                </Button>
              </PaginationListItem>
              <PaginationEllipsis
                v-else
                :key="item.type"
                :index="index"
                class="size-5"
              />
            </template>
            <PaginationNext class="size-5" />
            <PaginationLast class="size-5" />
          </PaginationList>
        </Pagination>
      </div>
    </template>

    <template v-else-if="loading">
      <div class="flex-center min-h-37.5 w-full gap-2 text-muted-foreground">
        <LoaderCircle class="size-4 animate-spin" />
        <div class="text-sm">{{ $t('ui.iconPicker.loading') }}</div>
      </div>
    </template>

    <template v-else-if="loadFailed">
      <div class="flex-col-center min-h-37.5 w-full text-muted-foreground">
        <EmptyIcon class="size-10" />
        <div class="mt-1 text-sm">{{ $t('ui.iconPicker.loadFailed') }}</div>
        <Button
          class="mt-2"
          data-testid="icon-picker-retry-btn"
          size="sm"
          variant="outline"
          @click="loadIcons(prefix)"
        >
          {{ $t('ui.iconPicker.retry') }}
        </Button>
      </div>
    </template>

    <template v-else>
      <div class="flex-col-center min-h-37.5 w-full text-muted-foreground">
        <EmptyIcon class="size-10" />
        <div class="mt-1 text-sm">{{ $t('common.noData') }}</div>
      </div>
    </template>
  </VbenPopover>
</template>
