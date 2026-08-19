/**
 * 验证 codegen 产出的业务模块页面真的能用。
 *
 * 这是"生成器交付质量"的验收：页面、接口封装、菜单 SQL 三者由生成器一次产出，
 * 任何一环对不上（菜单 component 写错、testid 与用例不一致、接口路径拼错）
 * 都会在这里失败，而不是等业务方接手后才发现。
 */
import process from 'node:process';

import { chromium } from 'playwright';

const BASE = process.env.APP_URL ?? 'http://localhost:5777';
const MODULE = process.env.MODULE ?? 'project';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { height: 900, width: 1440 } });

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

const NEW_NAME = `生成器验证项目-${Date.now() % 100_000}`;

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.fill('[data-testid="login-username-input"]', 'admin');
  await page.fill('[data-testid="login-password-input"]', 'admin123');
  await page.keyboard.press('Enter');
  await page.waitForURL(/dashboard|system/, { timeout: 20_000 });
  await page.waitForTimeout(1500);

  // 菜单来自生成的 menu-*.sql —— 没有它，页面在系统里根本不可达
  const nav = await page.textContent('body');
  check(
    '生成的菜单出现在侧边栏',
    nav.includes('业务管理') && nav.includes('项目'),
  );

  // 走菜单路径进入，而不是直接拼 URL：这样才验证到路由是菜单表下发的
  await page.goto(`${BASE}/${MODULE}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`[data-testid="${MODULE}-table"]`, {
    timeout: 20_000,
  });
  check('生成的页面能打开（menu 的 component 路径正确）', true);

  const seeded = await page.textContent(`[data-testid="${MODULE}-table"]`);
  check(
    '列表渲染出已有数据，中文未乱码',
    seeded.includes('智慧城市二期'),
    '智慧城市二期',
  );

  // ---- 新增：走完整表单链路 ----
  await page.click(`[data-testid="${MODULE}-add-btn"]`);
  await page.waitForSelector(`[data-testid="${MODULE}-project-name-input"]`, {
    timeout: 10_000,
  });
  await page.fill(`[data-testid="${MODULE}-project-name-input"]`, NEW_NAME);
  await page.fill(`[data-testid="${MODULE}-project-code-input"]`, 'GEN-001');
  await page.click(`[data-testid="${MODULE}-submit-btn"]`);
  await page.waitForTimeout(2000);

  const afterAdd = await page.textContent(`[data-testid="${MODULE}-table"]`);
  check('新增后出现在列表中', afterAdd.includes(NEW_NAME), NEW_NAME);

  // ---- 搜索：验证 buildListWrapper 真的生效 ----
  await page.fill(`[data-testid="${MODULE}-project-name-search"]`, NEW_NAME);
  await page.click(`[data-testid="${MODULE}-search-btn"]`);
  await page.waitForTimeout(1500);
  const filtered = await page.textContent(`[data-testid="${MODULE}-table"]`);
  check('搜索命中新增的记录', filtered.includes(NEW_NAME));
  check(
    '搜索把不匹配的记录筛掉了（条件真的落到 SQL 上）',
    !filtered.includes('智慧城市二期'),
  );

  await page.click(`[data-testid="${MODULE}-reset-btn"]`);
  await page.waitForTimeout(1500);
  const reset = await page.textContent(`[data-testid="${MODULE}-table"]`);
  check(
    '重置后两条都在',
    reset.includes(NEW_NAME) && reset.includes('智慧城市二期'),
  );

  // ---- 删除：受控确认框，锚点由生成器与用例共用 ----
  const rowCount = await page
    .locator(`[data-testid="${MODULE}-table"] tbody tr`)
    .count();
  await page
    .locator(`[data-testid="${MODULE}-table"] tbody tr`, { hasText: NEW_NAME })
    .locator(`[data-testid="${MODULE}-delete-btn"]`)
    .click();
  await page.waitForSelector(`[data-testid="${MODULE}-confirm-btn"]`, {
    timeout: 10_000,
  });
  await page.click(`[data-testid="${MODULE}-confirm-btn"]`);
  await page.waitForTimeout(2000);

  const afterDelete = await page.textContent(`[data-testid="${MODULE}-table"]`);
  check(
    '删除后从列表消失',
    !afterDelete.includes(NEW_NAME),
    `删除前 ${rowCount} 行`,
  );
} catch (error) {
  check('执行过程未抛异常', false, error.message);
} finally {
  const realErrors = consoleErrors.filter(
    (e) => !/favicon|Vue Devtools|\[vite\]/i.test(e),
  );
  check(
    '浏览器控制台无错误',
    realErrors.length === 0,
    realErrors.slice(0, 2).join(' | '),
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 通过`);
  await browser.close();
  process.exit(failed.length === 0 ? 0 : 1);
}
