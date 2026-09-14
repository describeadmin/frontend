import type { VbenFormSchema } from '@describeadmin/ui';

import { defineComponent, h } from 'vue';

import { useVbenForm } from '@describeadmin/ui';

import { ElButton } from 'element-plus';

/**
 * `VbenFormSchema` 加一个可选的顶层 `data-testid`，用法与取舍同
 * `@describeadmin/create-app` 模板里的同名文件——两者是同一套 UX 在不同包的落地：
 * 业务方生成的列表页走模板那份，本包自带的系统管理列表页（用户/角色/部门…）走这份。
 * 不能合并成一份共享实现——本包不知道消费方 app 声明的 `ComponentType`，
 * 只能退回 `@describeadmin/ui` 默认导出的 `VbenFormSchema`（其 `component` 字段
 * 底层是 `BaseFormComponentType`，末尾带 `Record<never, never> & string` 转义，
 * 本就接受任意字符串），字段用 `'Input'`/`'Select'`/`'DatePicker'` 等 adapter 别名——
 * 这些组件由消费方 app 的 `initComponentAdapter()` 注册进同一个全局 `COMPONENT_MAP`
 * 单例，本包运行时不需要、也不能重新声明一遍。
 */
export type SearchFormSchema = VbenFormSchema & { 'data-testid'?: string };

export interface UseSearchFormOptions {
  /**
   * `data-testid` 前缀，如 `user`——拼出 `${testid}-search-form`/`-search-btn`/
   * `-reset-btn`，字段自己的 testid 在各自 schema 项的 `componentProps` 里另外写。
   */
  testid: string;
  /** 检索字段，见 `SearchFormSchema` 的说明。 */
  schema: SearchFormSchema[];
  /** 折叠时显示的行数，默认 1（只留一行常用条件）。 */
  collapsedRows?: number;
  /** 展开后的网格列数断点，默认到 xl 断点 4 列。 */
  wrapperClass?: string;
  labelWidth?: number;
  /**
   * 操作按钮（搜索/清空）在网格里的排布方式，默认 `rowEnd`——固定在网格最后一列，
   * 字段数不能整除列数时会自动换到下一行。**字段较少、又和另一个更宽的检索栏
   * 并排展示**（如字典管理左右两个面板）时，`rowEnd` 会把按钮推到很靠右/单独一行，
   * 两个检索栏因此不等高、下面的列表也跟着错位——这种场景改传 `'inline'`
   * （按钮紧跟在最后一个字段后面，按自然流排布），同时把 `wrapperClass` 的列数
   * 设为「字段数 + 1」，让按钮和字段稳定同一行。
   */
  actionLayout?: 'inline' | 'newLine' | 'rowEnd';
  /**
   * 是否显示「展开/收起」折叠按钮。不传时自动判断：字段数 <= 4 就不显示，
   * 所有字段直接平铺；字段数更多才需要折叠。
   */
  collapsible?: boolean;
  /**
   * 点「搜索」（或回车）时触发，`values` 是当前表单值（含 range 字段，值是
   * `[start, end] | null`）。在这里把值落回页面自己的查询状态、调用原有的
   * `load()`。
   */
  onSearch: (values: Record<string, any>) => Promise<void> | void;
  /**
   * 点「清空」时触发——此时 VbenForm 内部字段已经按 schema 的 `defaultValue`
   * 重置过一轮，这里把页面自己的查询状态（以及不在 schema 里的辅助状态）一并清空、
   * 重新加载。
   */
  onReset: () => Promise<void> | void;
}

/**
 * 列表页检索栏的统一封装——折叠检索栏 + 搜索/清空按钮 + 外层卡片背景。
 *
 * 与 `@describeadmin/create-app` 模板同名文件是同一份设计的两处实现，
 * 用法完全一致：
 * ```ts
 * const { SearchFormBar } = useSearchForm({
 *   testid: 'user',
 *   schema: searchSchema,
 *   onSearch: async (values) => { Object.assign(filter, values); await search(); },
 *   onReset: async () => { await resetFilter(); },
 * });
 * ```
 * ```html
 * <SearchFormBar />
 * ```
 */
export function useSearchForm(options: UseSearchFormOptions) {
  const {
    testid,
    schema,
    collapsedRows = 1,
    wrapperClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    labelWidth = 90,
    collapsible = schema.length > 4,
    actionLayout = 'rowEnd',
    onSearch,
    onReset,
  } = options;

  const [Form, formApi] = useVbenForm({
    schema,
    showCollapseButton: collapsible,
    collapsed: collapsible,
    collapsedRows,
    showDefaultActions: true,
    actionButtonsReverse: true,
    actionLayout,
    submitButtonOptions: { show: false },
    resetButtonOptions: { show: false },
    wrapperClass,
    commonConfig: { labelWidth, componentProps: { clearable: true } },
    handleSubmit: onSearch,
    handleReset: onReset,
  });

  async function handleSearchClick() {
    await formApi.validateAndSubmitForm();
  }

  async function handleResetClick() {
    await formApi.resetForm();
    await onReset();
  }

  const SearchFormBar = defineComponent({
    name: 'SearchFormBar',
    setup() {
      return () =>
        h(
          'div',
          {
            class: 'mb-4 rounded-lg border border-border bg-card p-4',
            'data-testid': `${testid}-search-form`,
          },
          [
            h(
              Form,
              {},
              {
                'submit-before': () =>
                  h(
                    ElButton,
                    {
                      type: 'primary',
                      'data-testid': `${testid}-search-btn`,
                      onClick: handleSearchClick,
                    },
                    { default: () => '搜索' },
                  ),
                'reset-before': () =>
                  h(
                    ElButton,
                    {
                      'data-testid': `${testid}-reset-btn`,
                      onClick: handleResetClick,
                    },
                    { default: () => '清空' },
                  ),
              },
            ),
          ],
        );
    },
  });

  return { formApi, SearchFormBar };
}
