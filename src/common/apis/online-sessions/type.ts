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

/** 按 IP 分组的一级行 */
export interface OnlineSessionGroup {
  ip: string
  deviceCount: number
  onlineCount: number
  banned: boolean
  lastHeartbeatAt: string | null
  firstSeenAt: string | null
}

export type OnlineSessionsGroupedResponseData = ApiResponseData<{
  groups: OnlineSessionGroup[]
  ipCount: number
  total: number
  onlineCount: number
  bannedCount: number
}>

export type DevicesByIpResponseData = ApiResponseData<{
  items: OnlineSessionData[]
  total: number
}>

/** IP 封禁记录 */
export interface IpBanData {
  id: number
  ip: string
  reason: string | null
  createdAt: string
}

export type IpBanListResponseData = ApiResponseData<{
  items: IpBanData[]
  total: number
}>

export type BanIpResponseData = ApiResponseData<{
  success: boolean
  ip: string
}>
