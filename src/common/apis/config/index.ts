import type * as Config from "./type"
import { request } from "@/http/axios"

/** 获取所有配置 */
export function getConfigApi() {
  return request<Config.ConfigResponseData>({
    url: "config",
    method: "get"
  })
}

/** 更新配置 */
export function updateConfigApi(data: Record<string, string>) {
  return request({
    url: "config",
    method: "post",
    data
  })
}
