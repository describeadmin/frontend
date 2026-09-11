import type { Component, VNode } from 'vue';

export interface IconPickerProps {
  pageSize?: number;
  /** 图标集的名字 */
  prefix?: string;
  /** 是否自动请求API以获得图标集的数据.提供prefix时有效 */
  autoFetchApi?: boolean;
  /**
   * 图标列表
   */
  icons?: string[];
  /**
   * Input 组件（组件定义，不是 VNode）。
   *
   * 类型里带上 `VNode` 只是为兼容历史声明——它真正被用在 `<component :is>` 上，
   * 传 VNode 实例是不生效的：调用方实际传的都是组件（如 ElInput）。
   */
  inputComponent?: Component | VNode;
  /** 图标插槽名，预览图标将被渲染到此插槽中 */
  iconSlot?: string;
  /** input组件的值属性名称 */
  modelValueProp?: string;
  /** 图标样式 */
  iconClass?: string;
  type?: 'icon' | 'input';
  /**
   * 浮层面板的类名，默认 `p-0 pt-3 w-full`。
   *
   * 面板自带宽度，要改宽度在这里覆盖；Tailwind 类需带 `!` 前缀才生效——
   * 组件库与本项目的 `.z-popup` 都是未分层样式，会压过 `@layer` 里的
   * utilities（见 CLAUDE.md §4.9）。
   */
  contentClass?: string;
  /**
   * 浮层面板的 z-index，默认跟随全局 `--popup-z-index`（2000）。
   *
   * **嵌在弹层里使用必须显式抬高**：Element Plus 的弹层 z-index 从 2000 起自增，
   * 首个 ElDialog 的遮罩就是 2001，默认值会被压在弹窗下面点不到。
   */
  zIndex?: number;
  /**
   * 是否提供「清空」入口（面板内按钮）。
   *
   * 不能依赖 Element Plus 的 `clearable`：它在 readonly 下不渲染清除按钮，
   * 而触发器恰恰要 readonly 才能挡住手输。
   */
  clearable?: boolean;
}
