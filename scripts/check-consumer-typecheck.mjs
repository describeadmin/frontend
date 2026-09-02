#!/usr/bin/env node
/**
 * 消费侧类型检查：以"业务方从 npm 安装发布产物"的视角，对 @describeadmin/* 的
 * dist/*.d.ts 跑一次真实 typecheck。
 *
 * 为什么需要它：
 * 框架自身的 typecheck（`turbo run typecheck`）只检查源码 src/，而发布出去的
 * dist/*.d.ts 由 tsdown/unplugin-dts 生成，生成过程不校验类型正确性。当某个类型
 * 只在函数返回类型里"间接"引用、dts 打包器又无法穿透外部依赖解析它时，会静默降级
 * 成 `undefined[]` 这类错误类型——真实案例：@describeadmin/access 的
 * generateAccessible 返回值 accessibleMenus 被降级成 undefined[]，导致业务方
 * `pnpm typecheck` 报 TS2345，而框架自身 typecheck 全绿。
 *
 * 原理：
 * 用 `pnpm pack` 把每个 @describeadmin/* 打成 tarball，再通过 pnpm `overrides`
 * 强制消费方解析 tarball 里的 dist/*.d.ts（而不是 monorepo 内的 src/*.ts），
 * 复现"真正从 registry 安装"时的类型解析路径。消费项目由 create-app 自己的 CLI
 * 生成，它的 src/router/guard.ts 里 `setAccessMenus(accessibleMenus)` 这类调用
 * 天然就是类型断言。
 *
 * ⚠️ 脚手架直接调 create-app 的 CLI，不在本文件里重抄 copyDir / 占位符展开 /
 * 外部依赖版本表——那套重复实现已经因为漏改 `_gitignore` 映射而踩过坑。这里只负责
 * pack + 写 overrides，其余交给唯一权威的 packages/create-app。
 *
 * 前置条件：已执行 `pnpm build`（各包 dist/*.d.ts 已生成）。缺了会明确报错，
 *          而不是拿一个没有类型的 tarball 跑出没意义的"通过"。
 * 用法：node scripts/check-consumer-typecheck.mjs
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const createAppDir = join(frontendRoot, 'packages', 'create-app');
const createAppCli = join(createAppDir, 'bin', 'create-app.mjs');

// create-app 的 CLI 只接受 /^[a-z][a-z0-9-]*$/ 的项目名。
const APP_NAME = 'consumer-app';

function run(cmd, args, opts = {}) {
  console.log(
    `$ ${cmd} ${args.join(' ')}${opts.cwd ? `   (cwd: ${opts.cwd})` : ''}`,
  );
  // Windows 下 .cmd 批处理不能被 execFileSync 直接 spawn（会 EINVAL），需经 shell。
  // 由此在 Windows 本地会触发 Node 的 DEP0190 弃用警告（shell:true + args 数组），
  // 参数全部来自脚本内部的临时目录路径与包名、无用户输入，无注入风险；
  // CI 运行在 linux（无 shell、无该警告），不受影响。
  execFileSync(cmd, args, {
    stdio: 'inherit',
    ...(process.platform === 'win32' ? { shell: true } : {}),
    ...opts,
  });
}

/** package.json 的 files（缺省 ["dist"]）——与 release.yml 的载荷校验同口径。 */
function shipPaths(pkgJson) {
  return Array.isArray(pkgJson.files) && pkgJson.files.length > 0
    ? pkgJson.files
    : ['dist'];
}

/**
 * 递归收集所有待发布的 @describeadmin/*。
 * 排除 create-app 自身（它是 CLI 不是依赖）与 private 包（release.yml 同样跳过）。
 */
function collectPublishablePackages() {
  const roots = [
    join(frontendRoot, 'packages'),
    join(frontendRoot, 'internal', 'tailwind-config'),
  ];
  const results = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === 'package.json') {
        const pkg = JSON.parse(readFileSync(full, 'utf8'));
        if (
          pkg.name?.startsWith('@describeadmin/') &&
          pkg.name !== '@describeadmin/create-app' &&
          !pkg.private
        ) {
          results.push({
            dir: dirname(full),
            name: pkg.name,
            version: pkg.version,
            files: shipPaths(pkg),
          });
        }
      }
    }
  };
  for (const root of roots) {
    if (existsSync(root)) {
      walk(root);
    }
  }
  return results;
}

/**
 * 发布载荷必须已经在 `pnpm build` 里生成——否则 pnpm pack 出的 tarball 没有
 * dist/*.d.ts，typecheck 跑出来的"通过"是假的。缺了直接报错并指明补救命令。
 */
function assertBuilt(packages) {
  const missing = [];
  for (const pkg of packages) {
    const hasPayload = pkg.files.some((rel) => {
      const abs = join(pkg.dir, rel);
      if (!existsSync(abs)) {
        return false;
      }
      return statSync(abs).isFile() || readdirSync(abs).length > 0;
    });
    if (!hasPayload) {
      missing.push(`${pkg.name}（缺 ${pkg.files.join(' / ')}）`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `以下包没有发布载荷，先在 frontend 根目录跑 \`pnpm build\` 再执行本脚本：\n  - ${missing.join('\n  - ')}`,
    );
  }
}

/**
 * 把 overrides 写进 app 的 pnpm-workspace.yaml，强制 @describeadmin/*（含 core-* 这类
 * 传递依赖）全部指向本地 tarball。
 * ⚠️ 必须写在 pnpm-workspace.yaml，不能写 package.json 的 `pnpm.overrides`——
 * pnpm 11 已不再读取后者（见 https://pnpm.io/settings）。
 * appDir 与 tarballDir 是同级目录，故用相对路径 `file:../tarballs/...`。
 */
function writeOverrides(appDir, tarballDir, packages) {
  const lines = ['overrides:'];
  for (const pkg of packages) {
    const slug = pkg.name.slice('@describeadmin/'.length);
    const tgz = `describeadmin-${slug}-${pkg.version}.tgz`;
    if (!existsSync(join(tarballDir, tgz))) {
      throw new Error(
        `打包产物缺失：${tgz}（${pkg.name} 的 pnpm pack 未产出预期文件）`,
      );
    }
    lines.push(`  '${pkg.name}': file:../tarballs/${tgz}`);
  }
  writeFileSync(join(appDir, 'pnpm-workspace.yaml'), `${lines.join('\n')}\n`);
}

function main() {
  // create-app 的 CLI 产物；`pnpm build` 通常已带上它，缺了就单独补构建这一个包。
  if (!existsSync(join(createAppDir, 'dist', 'index.mjs'))) {
    console.log('==> create-app 尚未构建，单独构建它');
    run('pnpm', ['--filter', '@describeadmin/create-app', 'build'], {
      cwd: frontendRoot,
    });
  }

  const packages = collectPublishablePackages();
  if (packages.length === 0) {
    throw new Error('未找到任何待发布的 @describeadmin/* 包');
  }
  assertBuilt(packages);

  // .changeset 把 @describeadmin/* 定义为 fixed 分组，全部包同版本，取第一个即可。
  const version = packages[0].version;

  const workDir = mkdtempSync(join(tmpdir(), 'consumer-typecheck-'));
  const tarballDir = join(workDir, 'tarballs');
  const appDir = join(workDir, APP_NAME);

  try {
    mkdirSync(tarballDir, { recursive: true });

    console.log(`==> 打包 ${packages.length} 个 @describeadmin/* 为 tarball`);
    for (const pkg of packages) {
      run('pnpm', ['pack', '--pack-destination', tarballDir], { cwd: pkg.dir });
    }

    console.log('==> 用 create-app 的 CLI 生成消费项目（真实脚手架路径）');
    run(process.execPath, [createAppCli, APP_NAME], { cwd: workDir });

    console.log(
      `==> 写入 overrides（@describeadmin/* → 本地 tarball，版本 ${version}）`,
    );
    writeOverrides(appDir, tarballDir, packages);

    console.log('==> 安装（overrides 指向 tarball，忽略 build 脚本）');
    run('pnpm', ['install', '--ignore-scripts'], { cwd: appDir });

    console.log('==> 消费侧 typecheck');
    run('pnpm', ['typecheck'], { cwd: appDir });

    console.log('==> 消费侧类型检查通过');
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  // 子进程的真实报错（TS2345 等）已经 stdio:inherit 打到日志里了，
  // 这里只补一句人话，不再把 execFileSync 的 Node 堆栈糊满 CI 日志。
  console.error(`\n✗ 消费侧类型检查未通过：${error.message}`);
  process.exit(1);
}
