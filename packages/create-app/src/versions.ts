/**
 * `@describeadmin/*` 版本清单。
 *
 * `@describeadmin/*` 全部包共用同一个版本号——`.changeset/config.json` 把
 * `@describeadmin/core-*` 与 `@describeadmin/*` 定义为一个 fixed 分组，任何一个包发版，
 * 全部包一起跳版本号，因此这里只需要维护一个常量，不需要逐包记录。
 *
 * ⚠️ 在真正打通发布链路（`pnpm publish` / registry 查询）之前，这里手工维护，
 * 必须与 `frontend/packages/*\/package.json` 里的实际版本保持一致。
 * 发布链路打通后，`getDescribeadminVersion` 应改为查询 npm registry，
 * 而不是继续读这个硬编码常量——切换点只有这一个函数，方便以后改。
 */
const DESCRIBEADMIN_VERSION = '0.1.0';

export function getDescribeadminVersion(): string {
  return DESCRIBEADMIN_VERSION;
}

/**
 * 模板 package.json 里，非 `@describeadmin/*` 但用 `catalog:` 占位的外部依赖版本。
 *
 * 同样手工维护，与 `frontend/pnpm-workspace.yaml` 的 `catalog:` 小节保持一致。
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
