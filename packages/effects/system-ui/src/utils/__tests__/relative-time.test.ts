import { describe, expect, it } from 'vitest';

import { relativeTime } from '../relative-time';

describe('relativeTime', () => {
  const now = new Date(2026, 9, 13, 12, 0, 0);

  it('按本地时间理解后端的 yyyy-MM-dd HH:mm:ss', () => {
    expect(relativeTime('2026-10-13 11:59:30', now)).toBe('刚刚');
    expect(relativeTime('2026-10-13 11:55:00', now)).toBe('5分钟前');
    expect(relativeTime('2026-10-13 09:00:00', now)).toBe('3小时前');
    expect(relativeTime('2026-10-11 12:00:00', now)).toBe('2天前');
  });

  it('一周以上给日期', () => {
    expect(relativeTime('2026-09-01 08:00:00', now)).toBe('2026-09-01');
  });

  it('空值给空串，解析不了原样返回', () => {
    expect(relativeTime(null, now)).toBe('');
    expect(relativeTime('不是时间', now)).toBe('不是时间');
  });
});
