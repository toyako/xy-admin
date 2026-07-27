import type * as Orders from "./type"
import { request } from "@/http/axios"

/** 获取订单列表 */
export function getOrdersApi(params: Orders.OrdersRequestData) {
  return request<Orders.OrdersResponseData>({
    url: "orders",
    method: "get",
    params: {
      page: params.currentPage,
      pageSize: params.size,
      status: params.status || undefined
    }
  })
}

/** 订单统计 */
export function getOrdersStatsApi() {
  return request<Orders.OrdersStatsResponseData>({
    url: "orders/stats/overview",
    method: "get"
  })
}
