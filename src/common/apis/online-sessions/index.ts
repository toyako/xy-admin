import type * as OnlineSessions from "./type"
import { request } from "@/http/axios"

/** 获取在线设备列表 */
export function getOnlineSessionsApi() {
  return request<OnlineSessions.OnlineSessionsResponseData>({
    url: "online-sessions",
    method: "get"
  })
}
