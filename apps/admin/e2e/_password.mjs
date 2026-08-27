/**
 * 解析 e2e 登录口令。
 *
 * 后端不再有固定的 admin/admin123：dev-seed 首次启动生成随机强口令，明文写到
 * 后端项目根的 `.passwd`。这里按优先级取：
 *   1. 环境变量 APP_PASSWORD（CI / 手动指定）
 *   2. 环境变量 APP_PASSWORD_FILE 指向的文件
 *   3. 从常见相对位置猜后端的 .passwd（与前端同级的 sample-app / describe-admin-app）
 * 都拿不到就抛错，提示怎么给。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const GUESS_PATHS = [
  '../sample-app/.passwd',
  '../../sample-app/.passwd',
  '../../../sample-app/.passwd',
  '../describe-admin-app/.passwd',
  '../../describe-admin-app/.passwd',
];

export function resolvePassword() {
  if (process.env.APP_PASSWORD) {
    return process.env.APP_PASSWORD.trim();
  }
  const explicitFile = process.env.APP_PASSWORD_FILE;
  if (explicitFile && fs.existsSync(explicitFile)) {
    return fs.readFileSync(explicitFile, 'utf8').trim();
  }
  for (const rel of GUESS_PATHS) {
    const p = path.resolve(process.cwd(), rel);
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8').trim();
    }
  }
  throw new Error(
    `拿不到登录口令：设置 APP_PASSWORD，或 APP_PASSWORD_FILE 指向后端的 .passwd，或把后端 .passwd 放在猜测路径之一：${GUESS_PATHS.join(' / ')}`,
  );
}
