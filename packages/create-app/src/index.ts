import { resolve } from 'node:path';
import process from 'node:process';

import { cancel, intro, isCancel, outro, text } from '@clack/prompts';
import { cac } from 'cac';

import { assertTargetDirIsUsable, generate } from './generate';

const PROJECT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

async function resolveProjectName(arg?: string): Promise<string> {
  if (arg) {
    if (!PROJECT_NAME_PATTERN.test(arg)) {
      cancel('项目名只允许小写字母、数字、短横线，且以字母开头。');
      process.exit(1);
    }
    return arg;
  }

  const answer = await text({
    message: '项目名称？',
    placeholder: 'my-app',
    validate(value) {
      if (!value) {
        return '项目名称不能为空';
      }
      if (!PROJECT_NAME_PATTERN.test(value)) {
        return '只允许小写字母、数字、短横线，且以字母开头';
      }
    },
  });

  if (isCancel(answer)) {
    cancel('已取消');
    process.exit(1);
  }

  return answer;
}

async function main() {
  const cli = cac('create-app');

  cli
    .command('[project-name]', '生成一个 describeadmin 业务前端应用外壳')
    .action(async (projectNameArg?: string) => {
      intro('npm create @describeadmin/app');

      const projectName = await resolveProjectName(projectNameArg);
      const targetDir = resolve(process.cwd(), projectName);

      try {
        assertTargetDirIsUsable(targetDir);
      } catch (error) {
        cancel((error as Error).message);
        process.exit(1);
      }

      generate({ projectName, targetDir });

      outro(
        [
          '完成。接下来：',
          '',
          `  cd ${projectName}`,
          '  pnpm install',
          '  pnpm dev',
          '',
          '默认代理到 http://localhost:8090（后端 sample-app 或你自己的服务），',
          '可用 VITE_PROXY_TARGET 环境变量覆盖。',
        ].join('\n'),
      );
    });

  cli.help();
  cli.parse();
}

main();
