import type * as OnlineSessions from "./type"
import { request } from "@/http/axios"

/** 获取在线设备列表（扁平，兼容旧调用） */
export function getOnlineSessionsApi() {
  return request<OnlineSessions.OnlineSessionsResponseData>({
    url: "online-sessions",
    method: "get"
  })
}

/** 按 IP 分组（树形一级数据） */
export function getGroupedOnlineSessionsApi() {
  return request<OnlineSessions.OnlineSessionsGroupedResponseData>({
    url: "online-sessions/grouped",
    method: "get"
  })
}

/** 懒加载：某 IP 下的设备明细 */
export function getDevicesByIpApi(ip: string) {
  return request<OnlineSessions.DevicesByIpResponseData>({
    url: "online-sessions/by-ip",
    method: "get",
    params: { ip }
  })
}

/** 封禁 IP */
export function banIpApi(ip: string, reason?: string) {
  return request<OnlineSessions.BanIpResponseData>({
    url: "online-sessions/ban-ip",
    method: "post",
    data: { ip, reason }
  })
}

/** 解禁 IP */
export function unbanIpApi(ip: string) {
  return request<OnlineSessions.BanIpResponseData>({
    url: "online-sessions/unban-ip",
    method: "post",
    data: { ip }
  })
}

/** 封禁列表 */
export function getIpBansApi() {
  return request<OnlineSessions.IpBanListResponseData>({
    url: "online-sessions/bans",
    method: "get"
  })
}
