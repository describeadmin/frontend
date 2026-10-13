import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/** 后端 PoW 验证码挑战的 payload（`GET /api/auth/captcha` 且 `type === 'pow'`）。 */
export interface PowChallengePayload {
  algorithm: string;
  challenge: string;
  maxNumber: number;
  salt: string;
}

/** 每算这么多次让出一次主线程，求解期间界面（按钮 loading、提示文字）不卡。 */
const YIELD_EVERY = 2000;

/**
 * 求解后端 PoW 验证码：从 0 起逐个尝试 n，直到 `hex(SHA-256(salt + n))` 等于 `challenge`，
 * 返回的 n 即提交给后端的 `captchaCode`。口径必须与后端 `PowCaptchaProvider.hash` 逐字节一致。
 *
 * 用 `@noble/hashes` 而不是 `crypto.subtle`：后者只在安全上下文（HTTPS / localhost）可用，
 * 政务内网常见的 `http://10.x.x.x` 部署下是 `undefined`；而且对这种短输入，同步 JS 比
 * subtle 每次都要 await 一轮还快。
 */
export async function solvePow(
  payload: PowChallengePayload,
  signal?: AbortSignal,
): Promise<number> {
  if (payload.algorithm !== 'SHA-256') {
    throw new Error(`不支持的 PoW 算法: ${payload.algorithm}`);
  }
  const { challenge, salt } = payload;
  const max = Number(payload.maxNumber);
  for (let n = 0; n <= max; n++) {
    if (bytesToHex(sha256(utf8ToBytes(salt + n))) === challenge) {
      return n;
    }
    if (n % YIELD_EVERY === YIELD_EVERY - 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      signal?.throwIfAborted();
    }
  }
  throw new Error('PoW 在 maxNumber 内无解');
}
