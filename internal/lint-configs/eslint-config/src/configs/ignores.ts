import type { Linter } from 'eslint';

export async function ignores(): Promise<Linter.Config[]> {
  return [
    {
      ignores: [
        '**/node_modules',
        // create-app 的脚手架模板是「随包发布、展开到新工程」的载荷，不是本仓源码：
        // 它的清单叫 _package.json（避开 publint 对嵌套 package.json 的 imports 报错），
        // 因而 eslint 在这里解析不到它的 devDependencies，n/no-extraneous-import 会误报。
        // 模板里的 .vue/.ts 与 apps/admin 外壳同源，在那边已受 lint 覆盖。
        '**/packages/create-app/template/**',
        '**/dist',
        '**/dist-*',
        '**/*-dist',
        '**/.husky',
        '**/.nitro',
        '**/.output',
        '**/Dockerfile',
        '**/package-lock.json',
        '**/yarn.lock',
        '**/pnpm-lock.yaml',
        '**/bun.lockb',
        '**/output',
        '**/coverage',
        '**/temp',
        '**/.temp',
        '**/tmp',
        '**/.tmp',
        '**/.history',
        '**/.turbo',
        '**/.nuxt',
        '**/.next',
        '**/.vercel',
        '**/.changeset',
        '**/.idea',
        '**/.cache',
        '**/.output',
        '**/.vite-inspect',

        '**/CHANGELOG*.md',
        '**/*.min.*',
        '**/LICENSE*',
        '**/__snapshots__',
        '**/*.snap',
        '**/fixtures/**',
        '**/.vitepress/cache/**',
        '**/auto-import?(s).d.ts',
        '**/components.d.ts',
        '**/vite.config.mts.*',
        '**/*.sh',
        '**/*.ttf',
        '**/*.woff',
        '**/.github',
        '**/lefthook.yml',

        '**/.agent/**',
        '**/.agents/**',
        '**/.codex/**',
        '**/.claude/**',
        '**/.cursor/**',
      ],
    },
  ];
}
