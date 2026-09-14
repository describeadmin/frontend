import type { VbenFormSchema } from '#/adapter/form';

import { defineComponent, h } from 'vue';

import { ElButton } from 'element-plus';

import { useVbenForm } from '#/adapter/form';

/**
 * `VbenFormSchema` 加一个可选的顶层 `data-testid`。
 *
 * element-plus 的 `daterange`/`monthrange` 型 `ElDatePicker` 不会把 `data-testid`
 * 透传到任何 DOM 节点上——这是 element-plus 自身的行为（哪怕是原生模板直接写
 * `<ElDatePicker data-testid="..." type="daterange" />` 也测不到，不是这套封装引入的），
 * 日期区间字段退而求其次，把 `data-testid` 放在这个顶层（而不是 `componentProps` 里），
 * 会落在 VbenForm 统一渲染的 FormItem 外层 div 上——至少能定位到、点开面板，比完全测不到强。
 * 其它字段类型不需要这个顶层 key，直接在 `componentProps` 里传 `data-testid` 即可。
 */
export type SearchFormSchema = VbenFormSchema & { 'data-testid'?: string };

export interface UseSearchFormOptions {
  /**
   * `data-testid` 前缀，如 `employee-leave`——拼出
   * `${testid}-search-form`/`-search-btn`/`-reset-btn`，字段自己的 testid 在各自 schema
   * 项的 `componentProps` 里另外写。
   */
  testid: string;
  /** 检索字段。field 组件直接传 `'Input'`/`'Select'`/`'DatePicker'` 等 adapter 别名字符串，
   * 或者业务自己的组件（如自定义的远程搜索下拉）——后者记得 `markRaw()`，否则会触发
   * "Vue received a Component that was made a reactive object" 警告。
   * `componentProps` 必须是函数（哪怕没有动态依赖），运行时会校验类型。 */
  schema: SearchFormSchema[];
  /** 折叠时显示的行数，默认 1（只留一行常用条件）。 */
  collapsedRows?: number;
  /** 展开后的网格列数断点，默认到 xl 断点 4 列。 */
  wrapperClass?: string;
  labelWidth?: number;
  /**
   * 是否显示「展开/收起」折叠按钮。不传时自动判断：字段数 <= 4（默认网格在最宽的 xl
   * 断点正好 4 列，字段数不超过这个数，最宽时必然一行放得下，折叠按钮点了也没东西可收，
   * 纯属摆设）就不显示，所有字段直接平铺；字段数更多才需要折叠。用了非默认 `wrapperClass`
   * （列数不是 4）时这个默认阈值不准，自己传 `true`/`false` 显式指定。
   */
  collapsible?: boolean;
  /**
   * 点「搜索」（或回车）时触发，`values` 是当前表单值（含 range 字段，值是
   * `[start, end] | null`）。在这里把值落回页面自己的查询状态、调用原有的
   * `doSearch()`/`load()`。
   */
  onSearch: (values: Record<string, any>) => void | Promise<void>;
  /**
   * 点「清空」时触发——此时 VbenForm 内部字段已经按 schema 的 `defaultValue`
   * 重置过一轮，这里把页面自己的查询状态（以及不在 schema 里的辅助状态）一并清空、
   * 重新加载。
   */
  onReset: () => void | Promise<void>;
}

/**
 * 列表页检索栏的统一封装——折叠检索栏 + 搜索/清空按钮 + 外层卡片背景。
 *
 * 背景：`Page` 内容区没有卡片背景，检索栏单独套一层
 * `rounded-lg border border-border bg-card`，不然会透出页面本身的灰底。
 *
 * 用法：
 * ```ts
 * const { SearchFormBar } = useSearchForm({
 *   testid: 'employee-leave',
 *   schema: searchSchema,
 *   onSearch: async (values) => { Object.assign(search, values); await doSearch(); },
 *   onReset: async () => { await resetSearch(); },
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
    labelWidth = 110,
    collapsible = schema.length > 4,
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
            class: 'mb-2 rounded-lg border border-border bg-card p-4',
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
