export interface OnlineSessionData {
  id: number
  deviceId: string
  deviceName: string | null
  cardCode: string | null
  ip: string | null
  lastHeartbeatAt: string
  isOnline: boolean
  onlineDuration: number
  createdAt: string
  updatedAt: string
}

export type OnlineSessionsResponseData = ApiResponseData<{
  items: OnlineSessionData[]
  total: number
  onlineCount: number
}>
