import type * as AccountReports from "./type"
import { request } from "@/http/axios"

/** 顶层：设备节点列表（q 命中 账号/设备/卡号/角色名 归到所属设备） */
export function listDevicesApi(q?: string, limit = 200) {
  return request<AccountReports.DeviceListResponseData>({
    url: "account-reports/players",
    method: "get",
    params: { q: q || undefined, limit }
  })
}

/** 设备子树：设备 → 账号 → 区服 → 角色（懒加载展开设备时调用） */
export function deviceTreeApi(deviceId: string) {
  return request<AccountReports.DeviceTreeResponseData>({
    url: `account-reports/players/device/${encodeURIComponent(deviceId)}`,
    method: "get"
  })
}

/** 封禁 */
export function banPlayerApi(type: string, value: string, reason?: string, cascade = false) {
  return request<AccountReports.BanResponseData>({
    url: "account-reports/ban",
    method: "post",
    data: { type, value, reason, cascade }
  })
}

/** 解封 */
export function unbanPlayerApi(type: string, value: string) {
  return request<AccountReports.BanResponseData>({
    url: "account-reports/unban",
    method: "post",
    data: { type, value }
  })
}

/** 封禁列表 */
export function getAccountBansApi() {
  return request<AccountReports.AccountBanListResponseData>({
    url: "account-reports/bans",
    method: "get"
  })
}
