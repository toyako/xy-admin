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

/** 卡密统计 */
export function getCardsStatsApi() {
  return request<Cards.CardsStatsResponseData>({
    url: "cards/stats",
    method: "get"
  })
}
