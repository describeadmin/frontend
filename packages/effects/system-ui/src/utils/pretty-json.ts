export interface PrettyJson {
  text: string;
  /** 不是合法 JSON——操作日志的请求参数超过 2000 字符会被后端截断，最常见的就是这种。 */
  truncated: boolean;
}

/**
 * 给 JSON 串加缩进，**不经过 `JSON.parse`**。
 *
 * 两个原因都来自操作日志的请求参数（`SysOperLog.requestParam`）：
 *
 * 1. 后端截断到 2000 字符，截断后不是合法 JSON，`JSON.parse` 直接失败——可越长的参数
 *    越需要排版。逐字符重排对半截的串照样有效。
 * 2. `JSON.parse` 再 `stringify` 会把超过 2^53 的数字静默舍入（CLAUDE.md 4.8 那个雪花 ID 问题），
 *    审计日志里显示一个被改过的值比不排版更糟。这里只动字符串之外的空白，值原样保留。
 *
 * 不是 JSON 的（纯文本、后端的 `[参数序列化失败]` 占位）原样返回。
 */
export function prettyJson(raw: null | string | undefined): PrettyJson {
  const source = raw?.trim() ?? '';
  if (!source.startsWith('{') && !source.startsWith('[')) {
    return { text: raw ?? '', truncated: false };
  }

  let truncated = false;
  try {
    JSON.parse(source);
  } catch {
    truncated = true;
  }
  // `[参数序列化失败]` 以 `[` 开头但不是 JSON，排版只会把它拆碎。
  if (truncated && !looksLikeJson(source)) {
    return { text: raw ?? '', truncated: false };
  }

  const indent = (level: number) => '  '.repeat(level);
  let out = '';
  let level = 0;
  let inString = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source.charAt(i);
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += source[i + 1] ?? '';
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    switch (ch) {
      case '"': {
        inString = true;
        out += ch;
        break;
      }
      case ',': {
        out += `,\n${indent(level)}`;
        break;
      }
      case ':': {
        out += ': ';
        break;
      }
      case '[':
      case '{': {
        const close = ch === '{' ? '}' : ']';
        const next = nextNonSpace(source, i + 1);
        if (source[next] === close) {
          out += ch + close;
          i = next;
        } else {
          level++;
          out += `${ch}\n${indent(level)}`;
        }
        break;
      }
      case ']':
      case '}': {
        level = Math.max(0, level - 1);
        out += `\n${indent(level)}${ch}`;
        break;
      }
      default: {
        if (!/\s/.test(ch)) {
          out += ch;
        }
      }
    }
  }
  return { text: out, truncated };
}

function nextNonSpace(source: string, from: number): number {
  let i = from;
  while (i < source.length && /\s/.test(source.charAt(i))) {
    i++;
  }
  return i;
}

/** 截断的 JSON 第二个有效字符仍是 JSON 能出现的；`[参数…` 这种第二个字符是汉字。 */
function looksLikeJson(source: string): boolean {
  const second = source[nextNonSpace(source, 1)];
  return second === undefined || /["{[\]}\-\d tfn]/.test(second);
}
