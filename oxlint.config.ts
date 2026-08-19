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
  ],
});
