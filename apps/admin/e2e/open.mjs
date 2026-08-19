/**
 * 拉起一个**可见**的浏览器，登录后停在工作台，交给人接管。
 *
 * 与 smoke.mjs 的区别：这个脚本不做断言、不退出，只负责把人送进系统。
 * 用 headless: false + 独立用户目录，关掉自动化提示条，
 * 让它就是一个普通浏览器窗口，可以随便点。
 */
import path from 'node:path';
import process from 'node:process';

import { chromium } from 'playwright';

const BASE = process.env.APP_URL ?? 'http://localhost:5777';
const USERNAME = process.env.APP_USER ?? 'admin';
const PASSWORD = process.env.APP_PASSWORD ?? 'admin123';

// 独立用户目录：不碰你日常用的 Chrome 配置，也让登录态在下次打开时还在
const profileDir = path.join(
  process.cwd(),
  'node_modules',
  '.cache',
  'e2e-profile',
);

const context = await chromium.launchPersistentContext(profileDir, {
  args: ['--start-maximized'],
  channel: 'chrome',
  headless: false,
  viewport: null,
});

const page = context.pages()[0] ?? (await context.newPage());

await page.goto(BASE, { waitUntil: 'networkidle' });

// 已有登录态就直接进去，不必重复登录
const loginBox = page.locator('[data-testid="login-username-input"]');
if (await loginBox.count()) {
  await loginBox.fill(USERNAME);
  await page.fill('[data-testid="login-password-input"]', PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForURL(/dashboard|system/, { timeout: 30_000 });
  console.log(`已登录：${USERNAME}`);
} else {
  console.log('检测到已有登录态，直接进入');
}

await page.waitForTimeout(1500);
console.log(`当前页面：${page.url()}`);
console.log('');
console.log('浏览器已打开，可以自由操作。左侧菜单全部来自后端 sys_menu 表：');
console.log('  工作台 → 概览        数字来自真实接口');
console.log('  系统管理 → 用户 / 角色 / 菜单 / 部门');
console.log('');
console.log('关掉浏览器窗口即结束本脚本。');

// 等人关窗口
await new Promise((resolve) => context.on('close', resolve));
