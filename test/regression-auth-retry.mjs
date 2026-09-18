/**
 * 回归：Token 刷新重试策略（防止 login / logout 的 401 引发"无限刷请求"死循环）
 *
 * 背景（2026-09-18 修复）：
 *   任意 401 → 响应拦截器 handleTokenExpired → refreshToken() 失败
 *   → useUserStore().logout() → logout() 内发 POST /auth/logout
 *   → 又返回 401 → 再次进入拦截器 → 再次 logout() → ♻️ 无限循环
 *
 * 本用例只断言 src/http/auth-retry-policy.ts 里的纯函数（不依赖 vue / pinia / axios），
 * 用 esbuild 直接转译后加载。
 *
 * 运行：cd xy-admin && node test/regression-auth-retry.mjs
 */
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const require_ = createRequire(import.meta.url)
const esbuild = require_("esbuild")

const here = dirname(fileURLToPath(import.meta.url))
const srcPath = join(here, "..", "src", "http", "auth-retry-policy.ts")
const { code } = esbuild.transformSync(readFileSync(srcPath, "utf8"), {
  loader: "ts",
  format: "cjs"
})

const mod = { exports: {} }
// eslint-disable-next-line no-new-func
new Function("module", "exports", code)(mod, mod.exports)
const { shouldSkipAuthRefresh, isNoRefreshUrl, NO_REFRESH_URLS } = mod.exports

let pass = 0
let fail = 0
function assert(cond, msg) {
  if (cond) {
    pass++
    console.log(`  ✓ ${msg}`)
  } else {
    fail++
    console.log(`  ✗ ${msg}`)
  }
}

console.log("\n[1] isNoRefreshUrl —— 鉴权入口接口识别")
assert(isNoRefreshUrl("auth/login"), "auth/login 被识别")
assert(isNoRefreshUrl("auth/refresh"), "auth/refresh 被识别")
assert(isNoRefreshUrl("auth/logout"), "auth/logout 被识别")
assert(isNoRefreshUrl("/api/auth/logout"), "前缀 /api 也能识别")
assert(
  isNoRefreshUrl("https://api.yunzhiwu.xyz/api/auth/logout?x=1"),
  "绝对 URL + 查询串也能识别"
)
assert(!isNoRefreshUrl("orders"), "普通业务接口 orders 不被误伤")
assert(!isNoRefreshUrl("orders/XY20260918ABCD"), "订单查询接口不被误伤")
assert(!isNoRefreshUrl("cards/verify"), "卡密校验接口不被误伤")
assert(!isNoRefreshUrl(undefined), "undefined 返回 false")
assert(
  NO_REFRESH_URLS.length === 3 && NO_REFRESH_URLS.includes("auth/logout"),
  `白名单仅含三个鉴权入口（实测 ${NO_REFRESH_URLS.join(", ")}）`
)

console.log("\n[2] shouldSkipAuthRefresh —— 是否跳过刷新重试")
assert(!shouldSkipAuthRefresh({}), "普通请求（无标记）→ 允许刷新重试")
assert(
  shouldSkipAuthRefresh({ skipAuthRefresh: true }),
  "★ 显式 skipAuthRefresh → 跳过（login/logout/refresh 由 api 层声明）"
)
assert(
  shouldSkipAuthRefresh({ __isRetryRequest: true }),
  "★ 已重试过一次 → 跳过，任何请求最多重试一次"
)
assert(
  shouldSkipAuthRefresh({ url: "auth/logout" }),
  "★ URL 兜底：即使 api 层漏传标记，logout 也不会进入刷新流程"
)
assert(!shouldSkipAuthRefresh({ url: "orders" }), "普通业务接口仍可正常刷新重试")
assert(!shouldSkipAuthRefresh(undefined), "undefined 配置返回 false")

console.log("\n[3] 死循环场景回归")
// 模拟：logout() 发出的请求配置（api 层已声明 skipAuthRefresh）
const logoutConfig = { url: "auth/logout", method: "post", skipAuthRefresh: true }
assert(
  shouldSkipAuthRefresh(logoutConfig),
  "★ 登出请求的 401 不会触发刷新重试 → 断掉 logout→401→logout 的循环"
)
// 模拟：最坏情况（api 层忘了声明标记），仅凭 URL 也要能拦住
assert(
  shouldSkipAuthRefresh({ url: "auth/logout", method: "post" }),
  "★ 即便漏传标记，URL 兜底依然拦住登出请求（双保险）"
)
// 模拟：登录失败
const loginConfig = { url: "auth/login", method: "post", skipAuthRefresh: true }
assert(
  shouldSkipAuthRefresh(loginConfig),
  "★ 登录失败的 401 不会触发刷新重试（密码错误 ≠ 会话过期）"
)

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
