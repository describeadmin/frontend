import { describe, expect, it } from 'vitest';

import { solvePow } from '../solve-pow';

describe('solvePow', () => {
  it('matches the backend hash contract: hex(SHA-256(salt + n))', async () => {
    // printf 'abc123' | sha256sum，与后端 PowCaptchaProviderTest 用同一个向量
    const n = await solvePow({
      algorithm: 'SHA-256',
      challenge:
        '6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090',
      maxNumber: 1000,
      salt: 'abc',
    });
    expect(n).toBe(123);
  });

  it('rejects when there is no solution within maxNumber', async () => {
    await expect(
      solvePow({
        algorithm: 'SHA-256',
        challenge:
          '6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090',
        maxNumber: 100,
        salt: 'abc',
      }),
    ).rejects.toThrow('无解');
  });

  it('rejects unknown algorithms instead of looping forever', async () => {
    await expect(
      solvePow({ algorithm: 'MD5', challenge: '', maxNumber: 1, salt: '' }),
    ).rejects.toThrow('MD5');
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      solvePow(
        {
          algorithm: 'SHA-256',
          challenge: 'never',
          maxNumber: 100_000,
          salt: 'abc',
        },
        controller.signal,
      ),
    ).rejects.toThrow(/abort/i);
  });
});
