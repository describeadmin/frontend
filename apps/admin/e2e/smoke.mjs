/**
 * 端到端冒烟：真实浏览器 → vite dev server → 代理 → 真实后端 → MySQL 5.7。
 *
 * 断言刻意比对具体值（"超级管理员"、"部门管理"）而不是"元素存在"——
 * 字符集损坏时元素照样存在（CLAUDE.md 3.6）。
 */
import process from 'node:process';

import { chromium } from 'playwright';

import { resolvePassword } from './_password.mjs';

const BASE = 'http://localhost:5777';
const PASSWORD = resolvePassword();
const OUT = process.argv[2] ?? '.';

const results = [];
function check(name, ok, detail = '') {
  results.push({ detail, name, ok });
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
});
const page = await browser.newPage({ viewport: { height: 900, width: 1440 } });

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

try {
  // ---------------------------------------------------------------- 登录页
  // chromium.launch() 每次用全新的临时 profile，localStorage 本就是空的，
  // 不需要（也不能）在导航过程中去清——那样只会撞上应用自身的重定向
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="login-username-input"]', {
    timeout: 20_000,
  });
  check('登录页渲染，用户名输入框带 data-testid', true);

  const bodyText = await page.textContent('body');
  check(
    '登录页不再出现上游的演示账号',
    !bodyText.includes('jack') && !bodyText.includes('选择账号'),
    bodyText.includes('jack') ? '仍能看到 jack' : '',
  );

  // ---------------------------------------------------------------- 登录
  await page.fill('[data-testid="login-username-input"]', 'admin');
  await page.fill('[data-testid="login-password-input"]', PASSWORD);
  await page.keyboard.press('Enter');

  await page.waitForURL(/dashboard|system/, { timeout: 20_000 });
  check(
    '用户名密码登录成功并跳转到工作台',
    /dashboard/.test(page.url()),
    page.url(),
  );

  // 首页必须是真实内容，不是 404 兜底页
  await page.waitForSelector('[data-testid="dashboard-welcome-card"]', {
    timeout: 20_000,
  });
  const home = await page.textContent('[data-testid="dashboard-welcome-card"]');
  check(
    '工作台展示当前用户，且中文未乱码',
    home.includes('超级管理员'),
    home.trim().slice(0, 40),
  );
  const homeBody = await page.textContent('body');
  check('首页不是 404 兜底页', !homeBody.includes('未找到页面'));

  const token = await page.evaluate(() =>
    JSON.stringify(localStorage).includes('accessToken'),
  );
  check('令牌已写入前端存储', token);

  // ---------------------------------------------------------------- 动态菜单
  await page.waitForTimeout(1500);
  const nav = await page.textContent('body');
  for (const name of [
    '系统管理',
    '用户管理',
    '角色管理',
    '菜单管理',
    '部门管理',
  ]) {
    check(`后端下发的菜单「${name}」出现在侧边栏`, nav.includes(name));
  }

  // ---------------------------------------------------------------- 部门管理
  await page.goto(`${BASE}/system/dept`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="dept-table"]', { timeout: 20_000 });
  const deptText = await page.textContent('[data-testid="dept-table"]');
  check(
    '部门列表渲染出种子数据「总部」且中文未乱码',
    deptText.includes('总部'),
    deptText.slice(0, 60),
  );

  // 新增部门 —— 走完整的表单提交链路
  const NEW_DEPT = `端到端验证部-${Date.now() % 100_000}`;
  await page.click('[data-testid="dept-add-btn"]');
  await page.waitForSelector('[data-testid="dept-dept-name-input"]', {
    timeout: 10_000,
  });
  await page.fill('[data-testid="dept-dept-name-input"]', NEW_DEPT);
  await page.fill('[data-testid="dept-leader-input"]', '张三');
  await page.click('[data-testid="dept-submit-btn"]');
  await page.waitForTimeout(2000);

  const afterAdd = await page.textContent('[data-testid="dept-table"]');
  check('新增部门后出现在列表中', afterAdd.includes(NEW_DEPT), NEW_DEPT);
  check('新增时填写的负责人一并落库', afterAdd.includes('张三'));

  // ---------------------------------------------------------------- 用户管理
  await page.goto(`${BASE}/system/user`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="user-table"]', { timeout: 20_000 });
  const userText = await page.textContent('[data-testid="user-table"]');
  check(
    '用户列表渲染出 admin 且昵称中文正确',
    userText.includes('admin') && userText.includes('超级管理员'),
  );
  check('列表里不出现任何密码哈希痕迹', !userText.includes('$2a$'));

  // ---------------------------------------------------------------- 角色 / 菜单
  await page.goto(`${BASE}/system/role`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="role-table"]', { timeout: 20_000 });
  const roleText = await page.textContent('[data-testid="role-table"]');
  check('角色列表渲染出 ADMIN', roleText.includes('ADMIN'));

  // -------------------------------------------- 角色授权树：只给列表权限
  // 对一个**新建的临时角色**操作，不要碰 ADMIN——它的授权是种子数据，改了会污染
  // 本文件其余断言（以及同一个库上的后端 IT）。
  const grantRole = `E2E_GRANT_${Date.now()}`;
  await page.click('[data-testid="role-add-btn"]');
  await page.waitForSelector('[data-testid="role-form-dialog"]', {
    timeout: 20_000,
  });
  await page.fill('[data-testid="role-role-name-input"] input', '授权树冒烟');
  await page.fill('[data-testid="role-role-code-input"] input', grantRole);
  await page.click('[data-testid="role-submit-btn"]');
  await page.waitForTimeout(1200);
  const roleTableText = await page.textContent('[data-testid="role-table"]');
  check(
    '新建的临时角色出现在列表里',
    roleTableText.includes(grantRole),
    grantRole,
  );

  // 该角色所在行的「分配菜单」
  const grantRow = page.locator('[data-testid="role-table"] tr', {
    hasText: grantRole,
  });
  await grantRow.locator('[data-testid="role-assign-menu-btn"]').click();
  await page.waitForSelector('[data-testid="role-menu-tree"]', {
    timeout: 20_000,
  });

  // 授权树的节点用了自定义插槽（名称按关键字高亮 + 类型/权限标识），
  // ElTree 默认的 `.el-tree-node__label` 不再渲染，所以按节点内容里的
  // `.role-menu-node-name` 定位（CLAUDE.md 4.5.2）。
  const nodeContent = (label) =>
    page
      .locator('[data-testid="role-menu-tree"] .el-tree-node__content')
      .filter({ has: page.locator(`.role-menu-node-name:text-is("${label}")`) })
      .first();
  const nodeCheckbox = (label) => nodeContent(label).locator('.el-checkbox');
  const isChecked = async (label) =>
    await nodeCheckbox(label).evaluate((el) =>
      el.classList.contains('is-checked'),
    );
  const isIndeterminate = async (label) =>
    await nodeCheckbox(label).evaluate((el) =>
      el.classList.contains('is-indeterminate'),
    );
  const isVisible = async (label) => await nodeContent(label).isVisible();

  // 勾父：子节点跟着勾（便捷级联）
  await nodeCheckbox('用户管理').click();
  await page.waitForTimeout(300);
  check(
    '勾选「用户管理」后子节点「新增」也被勾上',
    (await isChecked('用户管理')) && (await isChecked('新增')),
  );

  // 取消一个子：父保持勾选 —— 这就是「只给列表权限」
  await nodeCheckbox('新增').click();
  await page.waitForTimeout(300);
  check(
    '取消子节点「新增」后「用户管理」仍为勾选',
    (await isChecked('用户管理')) && !(await isChecked('新增')),
  );
  check(
    'check-strictly 下父节点不出现半选态',
    !(await isIndeterminate('用户管理')),
  );

  await page.click('[data-testid="role-menu-submit-btn"]');
  await page.waitForTimeout(1200);

  // 重开弹窗：落库的和刚才看到的必须是同一个集合，且父目录被后端补齐
  await grantRow.locator('[data-testid="role-assign-menu-btn"]').click();
  await page.waitForSelector('[data-testid="role-menu-tree"]', {
    timeout: 20_000,
  });
  await page.waitForTimeout(500);
  check(
    '重开弹窗后「用户管理」仍勾选、「新增」仍未勾（勾选集合精确回填）',
    (await isChecked('用户管理')) && !(await isChecked('新增')),
  );
  check(
    '父目录「系统管理」被后端自动补齐（祖先闭包落库了）',
    await isChecked('系统管理'),
  );
  const menuCountText = await page.textContent(
    '[data-testid="role-menu-count"]',
  );
  check(
    '已选计数显示为 2 项（系统管理 + 用户管理）',
    menuCountText.includes('已选 2 项'),
    menuCountText,
  );

  // -------------------------------------------------- 分配菜单：检索 / 批量
  const menuCount = async () => {
    const text = await page.textContent('[data-testid="role-menu-count"]');
    return Number(/已选 (\d+) 项/.exec(text)?.[1] ?? -1);
  };

  await page.fill('[data-testid="role-menu-search-input"] input', '用户管理');
  await page.waitForTimeout(400);
  check(
    '检索命中「用户管理」时它的按钮可见、无关分支「角色管理」被隐藏',
    (await isVisible('新增')) && !(await isVisible('角色管理')),
  );

  await page.click('[data-testid="role-menu-select-all-btn"]');
  await page.waitForTimeout(400);
  check(
    '「全选结果」把命中节点的整枝都授出去（含未勾过的按钮）',
    (await isChecked('新增')) && (await menuCount()) > 2,
    `已选 ${await menuCount()} 项`,
  );

  await page.click('[data-testid="role-menu-unselect-all-btn"]');
  await page.waitForTimeout(400);
  check(
    '「取消全选结果」只收掉命中节点及其子孙，祖先「系统管理」不动',
    !(await isChecked('用户管理')) &&
      !(await isChecked('新增')) &&
      (await isChecked('系统管理')) &&
      (await menuCount()) === 1,
    `已选 ${await menuCount()} 项`,
  );

  await page.fill(
    '[data-testid="role-menu-search-input"] input',
    '这个菜单不存在',
  );
  await page.waitForTimeout(400);
  check(
    '检索无结果时给出空状态提示',
    await page.isVisible('[data-testid="role-menu-empty"]'),
  );

  await page.fill('[data-testid="role-menu-search-input"] input', '');
  await page.waitForTimeout(400);
  check('清空检索后分支重新出现', await isVisible('角色管理'));

  await page.click('[data-testid="role-menu-cancel-btn"]');
  await page.waitForTimeout(500);

  await page.goto(`${BASE}/system/menu`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="menu-table"]', { timeout: 20_000 });
  const menuText = await page.textContent('[data-testid="menu-table"]');
  check(
    '菜单管理能看到按钮级权限点',
    menuText.includes('system:user:add'),
    'system:user:add',
  );

  // ---------------------------------------------------------------- 未登录拦截
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/system/user`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('清空令牌后被挡回登录页', /login/.test(page.url()), page.url());

  await page.screenshot({ path: `${OUT}/e2e-final.png`, fullPage: false });
} catch (error) {
  check('执行过程未抛异常', false, error.message);
  await page.screenshot({ path: `${OUT}/e2e-error.png` }).catch(() => {});
} finally {
  const realErrors = consoleErrors.filter(
    (e) => !/favicon|Download the Vue Devtools|\[vite\]/i.test(e),
  );
  check(
    '浏览器控制台无错误',
    realErrors.length === 0,
    realErrors.slice(0, 3).join(' | '),
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 通过`);
  await browser.close();
  process.exit(failed.length === 0 ? 0 : 1);
}
