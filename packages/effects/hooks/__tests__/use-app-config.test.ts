import { afterEach, describe, expect, it } from 'vitest';

import { useAppConfig } from '../src/use-app-config';

describe('useAppConfig', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '_VBEN_ADMIN_PRO_APP_CONF_');
  });

  it('生产环境优先读 _app.config.js 注入的全局配置', () => {
    (window as any)._VBEN_ADMIN_PRO_APP_CONF_ = {
      VITE_GLOB_API_URL: '/from-file',
    };

    expect(
      useAppConfig({ VITE_GLOB_API_URL: '/from-build' }, true).apiURL,
    ).toBe('/from-file');
  });

  it('生产环境没有全局配置时退回构建期的 env，而不是抛错白屏', () => {
    expect(useAppConfig({ VITE_GLOB_API_URL: '/api' }, true).apiURL).toBe(
      '/api',
    );
  });

  it('开发环境只读 env', () => {
    (window as any)._VBEN_ADMIN_PRO_APP_CONF_ = {
      VITE_GLOB_API_URL: '/from-file',
    };

    expect(useAppConfig({ VITE_GLOB_API_URL: '/api' }, false).apiURL).toBe(
      '/api',
    );
  });
});
