import { describe, expect, it } from 'vitest';

import { prettyJson } from '../pretty-json';

describe('prettyJson', () => {
  it('合法 JSON 加两空格缩进，与 JSON.stringify 结果一致', () => {
    const raw = '[{"deptName":"研发部","sort":1,"tags":["a","b"]},"x"]';
    expect(prettyJson(raw)).toEqual({
      text: JSON.stringify(JSON.parse(raw), null, 2),
      truncated: false,
    });
  });

  it('空对象与空数组保持紧凑', () => {
    expect(prettyJson('[{},[]]').text).toBe('[\n  {},\n  []\n]');
  });

  it('字符串里的标点与转义引号不参与排版', () => {
    const raw = String.raw`{"remark":"a,b:{c}[d] \"q\""}`;
    expect(prettyJson(raw).text).toBe(String.raw`{
  "remark": "a,b:{c}[d] \"q\""
}`);
  });

  it('超过 2^53 的数字原样保留，不被舍入', () => {
    expect(prettyJson('[1234567890123456789]').text).toBe(
      '[\n  1234567890123456789\n]',
    );
  });

  it('后端截断的半截 JSON 照样排版并标记 truncated', () => {
    expect(prettyJson('[{"remark":"很长很长')).toEqual({
      text: '[\n  {\n    "remark": "很长很长',
      truncated: true,
    });
  });

  it('非 JSON 原样返回', () => {
    expect(prettyJson('[参数序列化失败]')).toEqual({
      text: '[参数序列化失败]',
      truncated: false,
    });
    expect(prettyJson('plain')).toEqual({ text: 'plain', truncated: false });
    expect(prettyJson(null)).toEqual({ text: '', truncated: false });
  });
});
