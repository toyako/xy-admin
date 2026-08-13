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

/** 卡密统计 */
export function getCardsStatsApi() {
  return request<Cards.CardsStatsResponseData>({
    url: "cards/stats",
    method: "get"
  })
}
