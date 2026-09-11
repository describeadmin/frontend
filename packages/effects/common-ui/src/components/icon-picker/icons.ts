import type { Recordable } from '@describeadmin/types';

/**
 * 一个缓存对象，在不刷新页面时，无需重复请求远程接口
 */
export const ICONS_MAP: Recordable<string[]> = {};

interface IconifyResponse {
  prefix: string;
  total: number;
  title: string;
  uncategorized?: string[];
  categories?: Recordable<string[]>;
  aliases?: Recordable<string>;
}

/** 在途请求：同一个图标集同时只会真正发出一次请求 */
const PENDING_REQUESTS = new Map<string, Promise<string[]>>();

/**
 * 通过Iconify接口获取图标集数据。
 * 同一时间多个图标选择器同时请求同一个图标集时，实际上只会发起一次请求（所有请求共享同一份结果）。
 * 请求结果会被缓存，刷新页面前同一个图标集不会再次请求
 * @param prefix 图标集名称
 * @returns 图标集中包含的所有图标名称
 */
export async function fetchIconsData(prefix: string): Promise<string[]> {
  const cached = ICONS_MAP[prefix];
  if (cached) {
    return cached;
  }
  const pending = PENDING_REQUESTS.get(prefix);
  if (pending) {
    return pending;
  }
  const request = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000 * 10);
    try {
      const response: IconifyResponse = await fetch(
        `https://api.iconify.design/collection?prefix=${prefix}`,
        { signal: controller.signal },
      ).then((res) => res.json());
      const list = response.uncategorized || [];
      if (response.categories) {
        for (const category in response.categories) {
          list.push(...(response.categories[category] || []));
        }
      }
      const icons = list.map((v) => `${prefix}:${v}`);
      ICONS_MAP[prefix] = icons;
      return icons;
    } catch (error) {
      console.error(`Failed to fetch icons for prefix ${prefix}:`, error);
      // 失败的 Promise 必须从在途表里摘掉，否则调用方重试时会命中这个已 reject 的
      // 旧 Promise，永远不产生新请求——「重试」点了没反应就是这么来的。
      PENDING_REQUESTS.delete(prefix);
      // 向上抛：此前是吞掉并返回空数组，界面只能显示「暂无数据」，
      // 与「图标集里确实没有匹配项」完全无法区分。
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  })();
  PENDING_REQUESTS.set(prefix, request);
  return request;
}
