import type { RequestClient } from '@describeadmin/request';

/**
 * 系统管理接口用哪个 requestClient 由消费方决定，本包不内置。
 *
 * 认证头、token 过期重登、错误提示这些策略天然是应用层可自定义的东西
 * （对照 apps/admin/src/api/request.ts 顶部注释："该文件可自行根据业务逻辑进行调整"），
 * 框架包不应该替业务方做这个选择，也没法访问业务方自己的 store（例如登出逻辑）。
 *
 * 消费方需在应用启动阶段、requestClient 创建完成后立即调用一次
 * `provideSystemApiClient(requestClient)`，之后系统管理页面与接口即可正常工作。
 */
let client: RequestClient | undefined;

export function provideSystemApiClient(requestClient: RequestClient): void {
  client = requestClient;
}

export function getSystemApiClient(): RequestClient {
  if (!client) {
    throw new Error(
      '[@describeadmin/system-ui] 使用系统管理接口前必须先调用 provideSystemApiClient(requestClient)，' +
        '通常在应用 bootstrap 阶段、requestClient 创建完成后立即调用一次。',
    );
  }
  return client;
}
