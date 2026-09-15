export interface OrderData {
  id: number
  orderNo: string
  cardType: string
  cardId: number | null
  amount: number
  status: string
  tradeNo: string | null
  buyerInfo: string | null
  createdAt: string
  paidAt: string | null
  /** 关联的卡密（管理端排查用，后端列表附带） */
  cardCode?: string | null
}

export interface OrdersRequestData {
  currentPage: number
  size: number
  status?: string
  /** 订单号（模糊） */
  orderNo?: string
  /** 卡密（模糊，自动忽略分隔符） */
  cardCode?: string
}

export interface OrdersStatsData {
  all: number
  pending: number
  paid: number
  todayOrders: number
  totalAmount: number
}

export type OrdersResponseData = ApiResponseData<{
  items: OrderData[]
  total: number
}>

export type OrdersStatsResponseData = ApiResponseData<OrdersStatsData>
