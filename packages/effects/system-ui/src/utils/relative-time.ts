const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * 后端时间串 → 「刚刚 / N分钟前 / N小时前 / N天前 / YYYY-MM-DD」。
 *
 * 后端按框架约定输出 `yyyy-MM-dd HH:mm:ss`、不带时区（CLAUDE.md 4.8：DB `DATETIME` →
 * `LocalDateTime` → 前端按浏览器本地时间理解）。把空格换成 `T` 后，`Date` 按规范把
 * 不带偏移的日期时间当本地时间解析，与这条口径一致。
 *
 * 一周以上直接给日期——"37天前"不如日期好认。解析失败原样返回，不吞掉信息。
 */
export function relativeTime(
  value: null | string | undefined,
  now: Date = new Date(),
): string {
  if (!value) {
    return '';
  }
  const time = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(time.getTime())) {
    return value;
  }
  const diff = now.getTime() - time.getTime();
  if (diff < MINUTE) {
    return '刚刚';
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)}分钟前`;
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)}小时前`;
  }
  if (diff < 7 * DAY) {
    return `${Math.floor(diff / DAY)}天前`;
  }
  return value.slice(0, 10);
}
