import type { Router } from 'vue-router';

import type { SysMessage } from '../api';

import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import {
  tryOnScopeDispose,
  useDocumentVisibility,
  useIntervalFn,
} from '@vueuse/core';
import { ElMessage } from 'element-plus';

import {
  clearReadMessagesApi,
  deleteMessageApi,
  getDictDataByTypeApi,
  getMessageInboxApi,
  readAllMessagesApi,
  readMessageApi,
} from '../api';
import { avatarUrl } from '../utils/avatar';
import { relativeTime } from '../utils/relative-time';

/** 站内信分类的字典类型，由 framework-system-starter 的 seed-rbac.sql 登记。 */
export const MESSAGE_CATEGORY_DICT = 'sys_message_category';

/** 默认轮询间隔：60 秒。 */
export const MESSAGE_POLL_INTERVAL = 60_000;

/**
 * 与 `@describeadmin/layouts` 的 `NotificationItem` 结构兼容，可直接喂给顶栏的
 * `<Notification>`。本包不依赖 layouts，所以这里自己声明一份。
 */
export interface MessageNotificationItem {
  /** 发送人头像地址；系统消息为空串，由 `<Notification>` 回落成铃铛图标。 */
  avatar: string;
  category: string;
  /** 分类的中文名；字典里没登记时就是分类编码本身。 */
  categoryLabel: string;
  date: string;
  id: string;
  isRead: boolean;
  link?: string;
  message: string;
  title: string;
}

// ------------------------------------------------------------ 分类显示名（全局共享）

const categoryLabels = ref<Record<string, string>>({});
let categoryLoading: null | Promise<void> = null;

/**
 * 取一次字典 `sys_message_category`，铃铛与消息中心共用。失败不重试本轮、不弹提示，
 * 显示名回落成编码——分类名是锦上添花，不该因为它让收件箱出错。
 */
export function loadMessageCategoryLabels(): Promise<void> {
  if (!categoryLoading) {
    categoryLoading = getDictDataByTypeApi(MESSAGE_CATEGORY_DICT)
      .then((items) => {
        const map: Record<string, string> = {};
        for (const item of items) {
          if (item.dictValue && item.dictLabel) {
            map[item.dictValue] = item.dictLabel;
          }
        }
        categoryLabels.value = map;
      })
      .catch(() => {
        categoryLoading = null;
      });
  }
  return categoryLoading;
}

export function messageCategoryLabel(category: string): string {
  return categoryLabels.value[category] ?? category;
}

/** 字典里登记过的分类，供消息中心的分类筛选下拉使用。 */
export const messageCategoryOptions = computed(() =>
  Object.entries(categoryLabels.value).map(([value, label]) => ({
    label,
    value,
  })),
);

// ------------------------------------------------------------ 跨组件同步

const inboxListeners = new Set<() => void>();

/**
 * 通知顶栏铃铛立刻重新拉取。消息中心里标已读、删除之后调用，免得铃铛上的红点
 * 要等下一轮轮询才消失。
 */
export function notifyInboxChanged(): void {
  inboxListeners.forEach((listener) => listener());
}

// ------------------------------------------------------------ 跳转

/**
 * 打开消息的站内链接。返回是否发生了跳转。
 *
 * 跳转前先 `router.resolve`：目标页没授权（隐藏菜单没勾，CLAUDE.md 4.5.1）或已下线时，
 * 解析结果只会命中全局 404 兜底路由（`/:path(.*)*`），这时给一句提示而不是把人送进
 * 404——否则看起来像"消息里的链接坏了"。真正的拦截仍在后端接口，这里只是体验。
 *
 * 详情页请 `watch(() => route.query.id)` 而不是只在 `onMounted` 里取一次：同一个详情页
 * 已经开着时，再点另一条消息只会换 query、复用组件（tabs 还带 keep-alive），页面不会刷新。
 */
export async function openMessageLink(
  router: Router,
  link: null | string | undefined,
): Promise<boolean> {
  if (!link) {
    return false;
  }
  const target = router.resolve(link);
  const leaf = target.matched.at(-1);
  if (!leaf || leaf.path.includes('(.*)')) {
    ElMessage.warning('无权访问该页面或页面已不存在');
    return false;
  }
  await router.push(link);
  return true;
}

export function toNotificationItem(msg: SysMessage): MessageNotificationItem {
  return {
    avatar: avatarUrl(msg.senderAvatar),
    category: msg.category,
    categoryLabel: messageCategoryLabel(msg.category),
    date: relativeTime(msg.createTime),
    id: msg.id,
    isRead: msg.readTime !== null,
    link: msg.link ?? undefined,
    message: msg.content ?? '',
    title: msg.title,
  };
}

// ------------------------------------------------------------ 铃铛

interface ItemRef {
  id: number | string;
  isRead?: boolean;
  link?: string;
}

/**
 * 顶栏铃铛的数据与动作。在 `basic.vue` 里一行接入：
 *
 * ```ts
 * const inbox = useMessageInbox();
 * ```
 *
 * ```html
 * <Notification :dot="inbox.showDot.value" :notifications="inbox.notifications.value"
 *   @read="inbox.read" @remove="inbox.remove" @make-all="inbox.readAll"
 *   @clear="inbox.clearRead" @on-click="inbox.open" @view-all="..." />
 * ```
 *
 * 轮询走 `background` 请求（见 `getMessageInboxApi`），页面在后台时暂停，
 * 回到前台立刻拉一次；组件卸载时自动停止。
 */
export function useMessageInbox(options: { interval?: number } = {}) {
  const router = useRouter();
  const unreadCount = ref(0);
  const latest = ref<SysMessage[]>([]);

  const notifications = computed(() =>
    latest.value.map((msg) => toNotificationItem(msg)),
  );
  const showDot = computed(() => unreadCount.value > 0);

  // 不写成 async 函数：它会被交给 useIntervalFn / 监听器集合当回调，oxc 的
  // no-async-endpoint-handlers 会把这种形状误判成 Express handler
  function refresh(): Promise<void> {
    return getMessageInboxApi()
      .then((inbox) => {
        unreadCount.value = inbox.unreadCount;
        latest.value = inbox.latest;
      })
      .catch(() => {
        // 后台请求失败静默：断网、令牌过期时下一轮再试，见 getMessageInboxApi
      });
  }

  const { pause, resume } = useIntervalFn(
    refresh,
    options.interval ?? MESSAGE_POLL_INTERVAL,
    { immediate: false },
  );
  const visibility = useDocumentVisibility();
  watch(visibility, (state) => {
    if (state === 'visible') {
      refresh();
      resume();
    } else {
      pause();
    }
  });

  inboxListeners.add(refresh);
  // useIntervalFn 在作用域销毁时自动清理定时器；监听器手动摘掉
  tryOnScopeDispose(() => inboxListeners.delete(refresh));

  onMounted(() => {
    loadMessageCategoryLabels();
    refresh();
    if (visibility.value === 'visible') {
      resume();
    }
  });

  async function read(item: ItemRef) {
    await quietly(() => readMessageApi(String(item.id)));
  }

  async function remove(item: ItemRef) {
    await quietly(() => deleteMessageApi(String(item.id)));
  }

  async function readAll() {
    await quietly(() => readAllMessagesApi());
  }

  async function clearRead() {
    await quietly(() => clearReadMessagesApi());
  }

  /** 点击一条消息：未读先标已读，再按 link 跳转。 */
  async function open(item: ItemRef) {
    if (!item.isRead) {
      await read(item);
    }
    try {
      await openMessageLink(router, item.link);
    } catch {
      // 目标页组件加载失败等导航错误，vue-router 已经输出过；这里不让它冒泡成未处理异常
    }
  }

  return {
    clearRead,
    notifications,
    open,
    read,
    readAll,
    refresh,
    remove,
    showDot,
    unreadCount,
  };
}

/**
 * 铃铛上的动作是事件回调，失败时请求层的拦截器已经弹过提示；这里吞掉异常，
 * 免得再冒泡成 Vue 的 "Unhandled error"。成功与否都通知刷新，让界面回到服务端的真实状态。
 */
async function quietly(action: () => Promise<unknown>) {
  try {
    await action();
  } catch {
    // 已由请求层提示
  } finally {
    notifyInboxChanged();
  }
}
