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
    method: "post"
  })
}

/** 登出（废弃服务端 Token） */
export function logoutApi() {
  return request({
    url: "auth/logout",
    method: "post"
  })
}
