import { randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { externalVersions, getDescribeadminVersion } from './versions';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(packageRoot, 'template');

// 模板清单以下划线前缀命名随包发布，展开时才落成真实文件名，见 copyDir 内注释。
const TEMPLATE_RENAMES = new Map([
  ['_gitignore', '.gitignore'],
  ['_package.json', 'package.json'],
]);

export interface GenerateOptions {
  projectName: string;
  targetDir: string;
}

export function assertTargetDirIsUsable(targetDir: string): void {
  if (!existsSync(targetDir)) {
    return;
  }
  const entries = readdirSync(targetDir);
  if (entries.length > 0) {
    throw new Error(
      `目标目录 ${targetDir} 已存在且非空，换一个目录名或先清空它。`,
    );
  }
}

export function generate({ projectName, targetDir }: GenerateOptions): void {
  copyDir(templateRoot, targetDir);
  rewritePackageJson(join(targetDir, 'package.json'), projectName);
  rewriteEnvFile(join(targetDir, '.env'), projectName);
}

function copyDir(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    // 模板清单以 `_package.json` 命名随包发布，展开时才落成 `package.json`：
    // 随包的嵌套 `package.json` 会被 publint（strict）判定为「imports 字段被忽略」而报错，
    // 而这个 imports（`#/*`）在模板成为项目根之后是生效且必须的。同 create-vite 的 `_gitignore`：
    // `.gitignore` 改为 `_gitignore` 随包发布，展开时再落成 `.gitignore`。
    const dstPath = join(dst, TEMPLATE_RENAMES.get(entry) ?? entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      writeFileSync(dstPath, readFileSync(srcPath));
    }
  }
}

/**
 * 把模板 package.json 里的 `workspace:*`（@describeadmin/* 内部依赖）与
 * `catalog:`（外部依赖）占位符替换成真实版本号，见 versions.ts 顶部注释。
 */
function rewritePackageJson(path: string, projectName: string): void {
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.name = projectName;

  for (const field of ['dependencies', 'devDependencies']) {
    const deps = pkg[field] as Record<string, string> | undefined;
    if (!deps) {
      continue;
    }
    for (const [name, value] of Object.entries(deps)) {
      if (value === 'workspace:*') {
        deps[name] = `^${getDescribeadminVersion()}`;
      } else if (value === 'catalog:') {
        const resolved = externalVersions[name];
        if (!resolved) {
          throw new Error(
            `versions.ts 里缺少 "${name}" 的版本条目——模板 package.json 用了 catalog: 占位，` +
              '但生成器不知道该填什么真实版本号，需要先在 versions.ts 补上。',
          );
        }
        deps[name] = resolved;
      }
    }
  }

  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

function rewriteEnvFile(path: string, projectName: string): void {
  const secureKey = randomBytes(24).toString('base64url');
  const content = readFileSync(path, 'utf8')
    .replaceAll('__PROJECT_NAME__', projectName)
    .replaceAll('__STORE_SECURE_KEY__', secureKey);
  writeFileSync(path, content);
}
