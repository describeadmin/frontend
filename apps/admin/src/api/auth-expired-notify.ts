/**
 * 跨 `requestClient` / `authLifecycleRequestClient` 共享的
 * "是否已经提示过一次登录已过期"标记。
 *
 * 见 request.ts 里 errorMessageResponseInterceptor 回调的 isAuthExpired 分支：同一次
 * 登录失效事件里，原始请求的 401、`/auth/refresh` 失败、`/auth/logout` 各自独立走一遍
 * 错误处理，不去重会连续弹出好几条内容还不一致的 toast。
 *
 * 刻意不放进 Pinia 的 accessStore：accessStore 会在 `logout()` 的 `resetAllStores()`
 * 里被整体重置，而 `resetAllStores()` 发生在 `doReAuthenticate()` → `logout()` 内部——
 * 早于触发这一整条链路的原始请求自己的 `throw error` 走到这里判断。标记若放在
 * accessStore 里会被这次重置提前清零，原始请求那一条反而绕过了去重，多弹一条
 * （实测：会从 3 条降到 2 条，但降不到 1 条）。用独立于 Pinia 生命周期的模块级变量，
 * 只在下一次登录成功后（见 store/auth.ts 的 authLogin）显式复位。
 */
let notified = false;

export function isAuthExpiredNotified(): boolean {
  return notified;
}

export function markAuthExpiredNotified(): void {
  notified = true;
}

/** 新一轮登录成功后调用，让下一次登录失效重新能弹出提示。 */
export function resetAuthExpiredNotified(): void {
  notified = false;
}
