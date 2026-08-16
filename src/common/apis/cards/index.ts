import type * as Cards from "./type"
import { request } from "@/http/axios"

/** 获取卡密列表（only=root 根卡分页 / children 换卡新卡全量） */
export function getCardsApi(params: Cards.CardsRequestData & { only?: "root" | "children" }) {
  return request<Cards.CardsResponseData>({
    url: "cards",
    method: "get",
    params: {
      page: params.currentPage,
      pageSize: params.size,
      status: params.status || undefined,
      code: params.code || undefined,
      batchNote: params.batchNote || undefined,
      only: params.only || undefined
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

/** 启用卡密（仅已禁用可启用，恢复为未使用） */
export function enableCardApi(id: number) {
  return request({
    url: `cards/${id}/enable`,
    method: "post"
  })
}

/** 批量禁用卡密（任何状态均可，已禁用跳过） */
export function batchDisableCardsApi(ids: number[]) {
  return request({
    url: "cards/batch-disable",
    method: "post",
    data: { ids }
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
