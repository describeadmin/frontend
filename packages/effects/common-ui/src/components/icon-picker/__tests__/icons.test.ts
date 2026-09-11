import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PREFIX = 'lucide';

/** 只需要 json()，不必造完整的 Response。 */
function jsonResponse(data: unknown): Response {
  return { json: async () => data } as Response;
}

/**
 * ICONS_MAP / PENDING_REQUESTS 都是模块级状态，每个用例都要重新加载模块，
 * 否则上一个用例的缓存与在途请求会污染下一个。
 */
async function loadModule() {
  vi.resetModules();
  return await import('../icons');
}

describe('fetchIconsData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('把 uncategorized 与 categories 合并成 prefix:name 列表，并缓存结果', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        categories: { 常用: ['users', 'menu'] },
        prefix: PREFIX,
        title: 'Lucide',
        total: 3,
        uncategorized: ['settings'],
      }),
    );
    const { fetchIconsData } = await loadModule();

    const expected = ['lucide:settings', 'lucide:users', 'lucide:menu'];
    await expect(fetchIconsData(PREFIX)).resolves.toEqual(expected);

    // 第二次命中 ICONS_MAP：结果一致且不再发请求
    await expect(fetchIconsData(PREFIX)).resolves.toEqual(expected);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.iconify.design/collection?prefix=${PREFIX}`,
      expect.anything(),
    );
  });

  it('请求失败时向上抛错，重试会真正重新请求', async () => {
    // 失败路径本来就要往控制台打错误，这里静音掉，别让测试输出里混进噪音
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { fetchIconsData } = await loadModule();

    await expect(fetchIconsData(PREFIX)).rejects.toThrow('network down');

    // 关键：失败的 Promise 必须已从在途表里摘掉。否则「重试」会命中它，
    // fetch 不会被再次调用，界面表现为点了没反应。
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        prefix: PREFIX,
        title: 'Lucide',
        total: 1,
        uncategorized: ['users'],
      }),
    );
    await expect(fetchIconsData(PREFIX)).resolves.toEqual(['lucide:users']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('并发调用共享同一次请求', async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValueOnce(pending);
    const { fetchIconsData } = await loadModule();

    const first = fetchIconsData(PREFIX);
    const second = fetchIconsData(PREFIX);
    resolveFetch(
      jsonResponse({
        prefix: PREFIX,
        title: 'Lucide',
        total: 1,
        uncategorized: ['users'],
      }),
    );

    await expect(first).resolves.toEqual(['lucide:users']);
    await expect(second).resolves.toEqual(['lucide:users']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
