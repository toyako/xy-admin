export interface CardData {
  id: number
  code: string
  type: string
  days: number
  status: string
  machineCode: string | null
  reportedIp: string | null
  realIp: string | null
  activatedAt: string | null
  expiresAt: string | null
  orderId: number | null
  batchNote: string
  verifiedCount: number
  lastVerifiedAt: string | null
  /** 来源：sale=销售库存 / gift=赠送卡 */
  source?: string
  giftReason?: string
  giftTo?: string | null
  giftedBy?: string | null
  giftedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface CardsRequestData {
  currentPage: number
  size: number
  status?: string
  code?: string
  batchNote?: string
  /** 卡密类型（minute/hour/day/month/quarter/year/lifetime） */
  type?: string
  /** 来源筛选：sale / gift，省略=全部 */
  source?: string
}

export interface CardsStatsData {
  all: number
  unused: number
  sold: number
  activated: number
  disabled: number
  replaced: number
  /** 赠送卡累计张数 */
  giftTotal?: number
  /** 赠送卡未激活张数 */
  giftPending?: number
  /** 赠送卡已激活张数 */
  giftUsed?: number
}

export type CardsResponseData = ApiResponseData<{
  items: CardData[]
  total: number
}>

export type CardsStatsResponseData = ApiResponseData<CardsStatsData>

export interface GenerateCardsRequestData {
  type: string
  days: number
  count: number
  batchNote: string
}

/** 赠送卡记录（source=gift） */
export interface GiftCardData {
  id: number
  code: string
  type: string
  days: number
  /** gifted=未激活 / activated=已激活 / disabled=已禁用 */
  status: string
  giftReason: string
  giftTo: string | null
  giftedBy: string | null
  giftedAt: string | null
  machineCode: string | null
  activatedAt: string | null
  expiresAt: string | null
  verifiedCount: number
  batchNote: string
  replaceFromId: number | null
  createdAt: string
}

export interface GiftCardsRequestData {
  currentPage: number
  size: number
  status?: string
  type?: string
  code?: string
  giftTo?: string
}

export type GiftCardsResponseData = ApiResponseData<{
  items: GiftCardData[]
  total: number
}>

/** 生成赠送卡 */
export interface GenerateGiftCardsRequestData {
  /** 套餐类型（时长以后端套餐表为准） */
  type: string
  /** 数量，1~100，默认 1 */
  count: number
  /** 赠送事由（如「BUG 反馈奖励」） */
  giftReason: string
  /** 受赠人（QQ / 昵称），可空 */
  giftTo?: string
}
