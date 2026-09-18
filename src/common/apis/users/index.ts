import type * as Users from "./type"
import { request } from "@/http/axios"

/** 获取当前登录用户详情 */
export function getCurrentUserApi() {
  return request<Users.CurrentUserResponseData>({
    url: "users/me",
    method: "get"
  })
}

/** 刷新 Token（需后端实现 POST /auth/refresh 接口） */
export function refreshTokenApi() {
  return request<Users.RefreshTokenResponseData>({
    url: "auth/refresh",
    method: "post",
    // 刷新接口自身返回 401 → 说明 refresh token 也失效了，不能再递归刷新
    skipAuthRefresh: true
  })
}

/** 登出（废弃服务端 Token） */
export function logoutApi() {
  return request({
    url: "auth/logout",
    method: "post",
    // ⚠️ 登出时 token 往往已失效，该请求会返回 401；
    //    若让它进入刷新重试流程，就会 logout → 401 → logout 无限循环
    skipAuthRefresh: true
  })
}
