# 端到端冒烟

```bash
# 1. 起数据库
docker run -d --name da-mysql -p 3307:3306 \
  -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=describeadmin \
  -e MYSQL_USER=app -e MYSQL_PASSWORD=app \
  mysql:5.7 --character-set-server=utf8mb4 --collation-server=utf8mb4_general_ci

# 2. 起后端：任一消费框架的业务工程（describeadmin-archetype 生成的脚手架即可），
#    默认端口 8090 —— 前端代理的目标，见 apps/admin/vite.config.ts 的 proxyTarget，
#    撞端口时用环境变量 VITE_PROXY_TARGET 绕开
mvn -f <你的业务后端>/pom.xml spring-boot:run -Dspring-boot.run.profiles=local

# 3. 起前端
pnpm dev

# 4. 跑冒烟
pnpm -F @describeadmin/admin run test:e2e
```

登录口令由后端 dev-seed 首次启动时随机生成，明文写在**该后端工程**根目录的 `.passwd` （取法见 `_password.mjs`）。重建空库时 dev-seed 会复用已有的 `.passwd`，口令不变；但库里已有用户时它整体跳过，⚠️ 换成别处拷来的库、或在界面上改过 admin 的密码，`.passwd` 就对不上了；后端有登录失败锁定策略，**不要反复试密码**，直接从当前这个后端实例的 `.passwd` 取，或用 `APP_PASSWORD` 显式指定。

链路是**真实的**：真实浏览器 → vite dev server → 代理 → Spring Boot → MySQL 5.7，没有任何一段是 mock。这正是删掉上游 `apps/backend-mock` 的原因——用 mock 开发前端，等于把前后端契约不一致的问题全部推迟到联调阶段才暴露。

## 断言纪律

断言一律比对**具体值**（`超级管理员`、`总部`），不比对「元素存在」或行数。字符集损坏时元素照样存在、`COUNT(*)` 照样正确，只有比对具体值才查得出（CLAUDE.md 3.6）。

同理，「未登录返回 401」这条在后端侧拆成四个断言（状态码 / 无 Location / Content-Type 是 JSON / 响应体无 `<html>`），只断其中一项都可能漏掉一半问题。

## 浏览器

用 `channel: 'chrome'` 驱动本机已安装的 Chrome，不下载 Playwright 自带的 Chromium——后者在受限网络下载不下来，而政务项目的开发机常处于这种网络。

## 与 codegen 的关系

本文件是**手写**的冒烟用例。`codegen` 为每个业务模块生成的页面遵循同一套 `data-testid` 命名约定（`<模块>-<对象>-<动作>`），针对生成模块补测试时按这套锚点定位即可。
