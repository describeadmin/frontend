import type { Linter } from 'eslint';

const restrictedImportIgnores = ['**/vite.config.mts'];

const customConfig: Linter.Config[] = [
  // shadcn-ui 内部组件是自动生成的，不做太多限制
  {
    files: ['packages/@core/ui-kit/shadcn-ui/**/**'],
    rules: {
      'vue/require-default-prop': 'off',
    },
  },
  {
    files: [
      'apps/**/**',
      'packages/effects/**/**',
      'packages/utils/**/**',
      'packages/types/**/**',
      'packages/locales/**/**',
    ],
    ignores: restrictedImportIgnores,
    rules: {
      'perfectionist/sort-interfaces': 'off',
    },
  },
  {
    // apps内部的一些基础规则
    files: ['apps/**/**'],
    ignores: restrictedImportIgnores,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['#/api/*'],
              message:
                'The #/api package cannot be imported, please use the @core package itself',
            },
            {
              group: ['#/layouts/*'],
              message:
                'The #/layouts package cannot be imported, please use the @core package itself',
            },
            {
              group: ['#/locales/*'],
              message:
                'The #/locales package cannot be imported, please use the @core package itself',
            },
            {
              group: ['#/stores/*'],
              message:
                'The #/stores package cannot be imported, please use the @core package itself',
            },
          ],
        },
      ],
    },
  },
  {
    // @core内部组件，不能引入@describeadmin/* 里面的包
    files: ['packages/@core/**/**'],
    ignores: restrictedImportIgnores,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // ⚠️ 必须排除 core-*：上游用 @vben / @vben-core 两个 scope 天然隔离，
              // 我们合并成单一 @describeadmin scope 后，不写这条否定规则的话
              // @core 内部包之间的正常互相引用会被全部误杀
              group: ['@describeadmin/*', '!@describeadmin/core-*'],
              message:
                '@core 层不能引入上层的 @describeadmin/* 包，只能引用 @describeadmin/core-* 自身',
            },
          ],
        },
      ],
    },
  },
  {
    // @core/shared内部组件，不能引入@describeadmin/* 或者 @describeadmin/core-* 里面的包
    files: ['packages/@core/base/**/**'],
    ignores: restrictedImportIgnores,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@describeadmin/*'],
              message:
                '@core/base 是最底层，不能引入任何 @describeadmin/* 包（含 core-*）',
            },
          ],
        },
      ],
    },
  },

  {
    // 不能引入@describeadmin/*里面的包
    files: [
      'packages/types/**/**',
      'packages/utils/**/**',
      'packages/icons/**/**',
      'packages/constants/**/**',
      'packages/styles/**/**',
      'packages/stores/**/**',
      'packages/preferences/**/**',
      'packages/locales/**/**',
    ],
    ignores: restrictedImportIgnores,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@describeadmin/*', '!@describeadmin/core-*'],
              message:
                '基础能力包不能引入上层的 @describeadmin/* 包，只能引用 @describeadmin/core-*',
            },
          ],
        },
      ],
    },
  },
  // 后端模拟代码，不需要太多规则
  {
    files: ['apps/backend-mock/**/**', 'docs/**/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/**/playwright.config.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['internal/**/**', 'scripts/**/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['packages/@core/base/shared/src/utils/inference.ts'],
    rules: {
      'vue/prefer-import-from-vue': 'off',
    },
  },
];

export { customConfig };
