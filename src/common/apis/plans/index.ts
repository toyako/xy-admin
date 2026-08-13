import { request } from "@/http/axios"

export interface PlanItem {
  id: number
  type: string
  name: string
  days: number
  price: number
  enabled: boolean
  sort: number
  stats?: {
    total: number
    sold: number
    expired: number
    available: number
  }
}

/** 套餐列表（含卡密统计） */
export function getPlansApi() {
  return request<ApiResponseData<PlanItem[]>>({
    url: "plans",
    method: "get"
  })
}

/** 新增套餐 */
export function createPlanApi(data: Partial<PlanItem>) {
  return request({
    url: "plans",
    method: "post",
    data
  })
}

/** 修改套餐 */
export function updatePlanApi(id: number, data: Partial<PlanItem>) {
  return request({
    url: `plans/${id}`,
    method: "patch",
    data
  })
}

/** 删除套餐 */
export function deletePlanApi(id: number) {
  return request({
    url: `plans/${id}`,
    method: "delete"
  })
}
