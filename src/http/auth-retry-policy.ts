/**
 * Token 刷新重试策略（纯函数，不依赖 vue / pinia / axios，便于单测）
 *
 * ## 背景：2026-09-18 修复的无限请求死循环
 *
 * ```
 * 任意 401（含登录密码错误、改密后旧 token 失效）
 *   → 响应拦截器 handleTokenExpired()
 *   → refreshToken() 失败
 *   → useUserStore().logout()
 *   → logout() 内部调用 logoutApi() 发 POST /auth/logout
 *   → 该请求同样返回 401
 *   → 再次进入响应拦截器 → 再次 logout() → ♻️ 无限循环刷请求
 * ```
 *
 * 断环的要点收敛到本文件，共三条：
 *   1. `login` / `logout` / `refresh` 这三个"鉴权入口"本身就会返回 401，一律不参与刷新重试；
 *   2. 任何请求最多只重试一次（`__isRetryRequest` 标记）；
 *   3. 401 兜底走"本地登出"（不发网络请求），避免再次触发拦截器。
 */

/** 不参与 token 刷新重试的接口（相对 baseURL 的路径） */
export const NO_REFRESH_URLS = ["auth/login", "auth/refresh", "auth/logout"] as const

/** 请求配置上的自定义标记（axios.ts 里通过 declare module 合并进 AxiosRequestConfig） */
export interface AuthRetryFlags {
  /** 该接口不参与 token 刷新重试（自身就会返回 401 的接口，如登录/登出） */
  skipAuthRefresh?: boolean
  /** 内部标记：本请求已因 token 过期重试过一次 */
  __isRetryRequest?: boolean
}

/**
 * 归一化 URL 用于比较：剥离协议+域名、前导 `/`、`api/` 前缀与查询串。
 * 这样 `auth/logout`、`/api/auth/logout`、`https://api.xxx/api/auth/logout?x=1`
 * 都能被识别为同一个接口。
 */
function normalizeUrl(url: string): string {
  return url
    .split("?")[0]
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^api\//i, "")
}

/** 该 URL 是否属于"不参与刷新"的鉴权入口接口 */
export function isNoRefreshUrl(url?: string | null): boolean {
  if (!url) return false
  const clean = normalizeUrl(String(url))
  return NO_REFRESH_URLS.some(u => clean === u || clean.endsWith(`/${u}`))
}

/**
 * 是否应跳过 token 刷新重试。
 *
 * 命中以下任一条件即跳过：
 *   - 显式标记 `skipAuthRefresh`（api 层声明）
 *   - 已重试过一次（`__isRetryRequest`）
 *   - URL 属于 login / refresh / logout（双保险：即使 api 层漏传标记也能拦住）
 */
export function shouldSkipAuthRefresh(
  config?: (AuthRetryFlags & { url?: string }) | null
): boolean {
  if (!config) return false
  if (config.skipAuthRefresh || config.__isRetryRequest) return true
  return isNoRefreshUrl(config.url)
}
