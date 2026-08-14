import type * as Cards from "./type"
import { request } from "@/http/axios"

/** 获取卡密列表 */
export function getCardsApi(params: Cards.CardsRequestData) {
  return request<Cards.CardsResponseData>({
    url: "cards",
    method: "get",
    params: {
      page: params.currentPage,
      pageSize: params.size,
      status: params.status || undefined,
      code: params.code || undefined,
      batchNote: params.batchNote || undefined
    }
  })
}

/** 批量生成卡密 */
export function generateCardsApi(data: Cards.GenerateCardsRequestData) {
  return request({
    url: "cards/generate",
    method: "post",
    data
  })
}

/** 禁用卡密 */
export function disableCardApi(id: number) {
  return request({
    url: `cards/${id}/disable`,
    method: "post"
  })
}

/** 删除卡密（仅未使用/已禁用） */
export function removeCardApi(id: number) {
  return request({
    url: `cards/${id}`,
    method: "delete"
  })
}

/** 批量删除卡密（仅未使用/已禁用，非法项跳过） */
export function batchRemoveCardsApi(ids: number[]) {
  return request({
    url: "cards/batch-delete",
    method: "post",
    data: { ids }
  })
}

/** 换卡/补卡（剩余时间转移到新卡，原卡作废） */
export function replaceCardApi(id: number) {
  return request({
    url: `cards/${id}/replace`,
    method: "post"
  })
}

/** 订单号查卡（返回订单 + 卡密 + 剩余时间） */
export function getCardByOrderApi(orderNo: string) {
  return request({
    url: `cards/by-order/${encodeURIComponent(orderNo)}`,
    method: "get"
  })
}

/** 卡密统计 */
export function getCardsStatsApi() {
  return request<Cards.CardsStatsResponseData>({
    url: "cards/stats",
    method: "get"
  })
}
