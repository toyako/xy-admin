import type * as Auth from "./type"
import { request } from "@/http/axios"

/** 登录并返回 Token */
export function loginApi(data: Auth.LoginRequestData) {
  return request<Auth.LoginResponseData>({
    url: "auth/login",
    method: "post",
    data,
    // 登录失败的 401 表示"账号密码不对"，而不是"会话过期"
    // → 绝不能进入 token 刷新重试流程（否则会引发无限循环刷请求）
    skipAuthRefresh: true
  })
}
