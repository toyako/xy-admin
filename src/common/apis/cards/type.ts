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
  createdAt: string
  updatedAt: string
}

export interface CardsRequestData {
  currentPage: number
  size: number
  status?: string
  code?: string
  batchNote?: string
}

export interface CardsStatsData {
  all: number
  unused: number
  sold: number
  activated: number
  disabled: number
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
