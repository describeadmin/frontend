import { oxlintConfig } from '@describeadmin/oxlint-config';

import { defineConfig } from 'oxlint';

export default defineConfig({
  ...oxlintConfig,
  overrides: [
    ...(oxlintConfig.overrides ?? []),
    {
      // 端到端脚本是命令行程序：打印结果、用退出码表达成败正是它的职责。
      // 一个不能输出、也不能设置退出码的测试脚本，在 CI 里毫无用处。
      files: ['**/e2e/**'],
      rules: {
        'no-console': 'off',
        'unicorn/no-process-exit': 'off',
      },
    },
    {
      // create-app 是真正对外发布的 CLI（bin 入口），取消/校验失败时用
      // process.exit() 中断是命令行程序的标准写法，同 scripts/**、internal/**
      // 的既有豁免（见 oxlint-config 的 overrides.ts），只是这个例外发生在
      // packages/ 下的一个可发布包里，不能靠那条规则覆盖到。
      files: ['packages/create-app/**'],
      rules: {
        'unicorn/no-process-exit': 'off',
      },
    },
  ],
});
