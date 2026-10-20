import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `@describeadmin/*` 版本号。
 *
 * `@describeadmin/*` 全部包共用同一个版本号——`.changeset/config.json` 把
 * `@describeadmin/core-*` 与 `@describeadmin/*` 定义为一个 fixed 分组，任何一个包发版，
 * 全部包一起跳版本号，因此生成器自己的版本就是模板该依赖的版本。
 *
 * 读本包的 `package.json` 而不是手写常量：手写常量曾经停在 0.2.0、包已经是 0.2.2，
 * 生成出的工程于是依赖 `^0.2.0`——能装上、能跑，只是悄悄落后，没有任何报错。
 * `package.json` 永远随包发布，`dist/` 与 `src/` 上一级都是包根目录。
 */
const DESCRIBEADMIN_VERSION: string = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'),
    'utf8',
  ),
).version;

export function getDescribeadminVersion(): string {
  return DESCRIBEADMIN_VERSION;
}

/**
 * 模板 package.json 里，非 `@describeadmin/*` 但用 `catalog:` 占位的外部依赖版本。
 *
 * 手工维护，与 `frontend/pnpm-workspace.yaml` 的 `catalog:` 小节保持一致。
 * 模板新增了 catalog 依赖、而这里没有对应条目时，生成器会直接报错——
 * 这是有意的：静默生成一个装不上的 package.json 比生成器报错更难排查。
 */
export const externalVersions: Record<string, string> = {
  '@tailwindcss/vite': '^4.3.0',
  '@types/node': '^25.9.1',
  '@vitejs/plugin-vue': '^6.0.7',
  '@vueuse/core': '^14.3.0',
  dayjs: '^1.11.20',
  'element-plus': '^2.14.0',
  pinia: '^3.0.4',
  sass: '^1.99.0',
  typescript: '^6.0.3',
  'unplugin-element-plus': '^0.11.2',
  vite: '^8.0.13',
  vue: '^3.5.34',
  'vue-router': '^5.0.7',
  'vue-tsc': '^3.3.1',
};
