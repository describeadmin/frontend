import type {
  ApplicationConfig,
  VbenAdminProAppConfigRaw,
} from '@describeadmin/types/global';

/**
 * 应用运行时配置（接口地址等 `VITE_GLOB_*`）。
 *
 * 生产环境优先读构建时生成、随产物部署的 `_app.config.js` 注入的
 * `window._VBEN_ADMIN_PRO_APP_CONF_`——部署时改这一个文件就能换后端地址，不用重新打包。
 *
 * 全局变量不存在时（没生成或没部署 `_app.config.js`）退回构建期的 `import.meta.env`，
 * 而不是在模块加载时对 `undefined` 解构抛错：那会让整个应用白屏，且只在生产构建里出现、
 * 开发模式永远看不到。
 */
export function useAppConfig(
  env: Record<string, any>,
  isProduction: boolean,
): ApplicationConfig {
  const injected = isProduction ? window._VBEN_ADMIN_PRO_APP_CONF_ : undefined;
  const config = (injected ?? env) as VbenAdminProAppConfigRaw;

  const {
    VITE_GLOB_API_URL,
    VITE_GLOB_AUTH_DINGDING_CORP_ID,
    VITE_GLOB_AUTH_DINGDING_CLIENT_ID,
  } = config;

  const applicationConfig: ApplicationConfig = {
    apiURL: VITE_GLOB_API_URL,
    auth: {},
  };
  if (VITE_GLOB_AUTH_DINGDING_CORP_ID && VITE_GLOB_AUTH_DINGDING_CLIENT_ID) {
    applicationConfig.auth.dingding = {
      clientId: VITE_GLOB_AUTH_DINGDING_CLIENT_ID,
      corpId: VITE_GLOB_AUTH_DINGDING_CORP_ID,
    };
  }

  return applicationConfig;
}
