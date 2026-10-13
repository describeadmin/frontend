import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authenticateResponseInterceptor,
  errorMessageResponseInterceptor,
} from './preset-interceptors';
import { RequestClient } from './request-client';

/**
 * `background: true` 的请求（铃铛轮询）遇到 401 时不能刷新令牌、不能触发重新登录、
 * 不能弹提示——否则开着不动的标签页会靠轮询一直续命，见 ExtendOptions.background。
 */
describe('background 请求', () => {
  let mock: MockAdapter;
  let client: RequestClient;
  let doRefreshToken: ReturnType<typeof vi.fn>;
  let doReAuthenticate: ReturnType<typeof vi.fn>;
  let makeErrorMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    client = new RequestClient();
    doRefreshToken = vi.fn(async () => 'new-token');
    doReAuthenticate = vi.fn(async () => {});
    makeErrorMessage = vi.fn();
    client.addResponseInterceptor(
      authenticateResponseInterceptor({
        client,
        doReAuthenticate,
        doRefreshToken,
        enableRefreshToken: true,
        formatToken: (token) => `Bearer ${token}`,
      }),
    );
    client.addResponseInterceptor(
      errorMessageResponseInterceptor(makeErrorMessage, {
        unauthorizedCode: 40_100,
      }),
    );
  });

  afterEach(() => {
    mock.reset();
  });

  it('401 时不刷新令牌、不重新登录、不弹提示', async () => {
    mock.onGet('/inbox').reply(401, { code: 40_100, message: '未认证' });

    await expect(
      client.get('/inbox', { background: true }),
    ).rejects.toBeTruthy();

    expect(doRefreshToken).not.toHaveBeenCalled();
    expect(doReAuthenticate).not.toHaveBeenCalled();
    expect(makeErrorMessage).not.toHaveBeenCalled();
  });

  it('其他错误同样不弹提示', async () => {
    mock.onGet('/inbox').reply(500, {});

    await expect(
      client.get('/inbox', { background: true }),
    ).rejects.toBeTruthy();

    expect(makeErrorMessage).not.toHaveBeenCalled();
  });

  it('普通请求 401 照常走刷新流程（对照组）', async () => {
    mock.onGet('/list').replyOnce(401, {}).onGet('/list').reply(200, 'ok');

    const response = await client.get<{ data: string }>('/list');

    expect(doRefreshToken).toHaveBeenCalledTimes(1);
    expect(response.data).toBe('ok');
  });
});
