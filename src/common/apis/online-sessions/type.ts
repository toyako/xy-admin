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
  // ===== 客户端构建信息（防克隆 · 2026-10-04）=====
  // ⚠️ 只有「带指纹上报的新客户端」才有值；老客户端为 null（页面显示「未上报」）
  /** 构建标识（打包时生成 build-id.json） */
  buildId?: string | null
  /** 分发渠道码（默认 official） */
  channel?: string | null
  /** 客户端代码指纹（app.asar sha256 前 32 位）—— 改过包就会变 */
  clientFp?: string | null
  /** 后端判定：指纹不在官方白名单 ⇒ 疑似被改包（`XY_OFFICIAL_FPS` 未配时恒 false） */
  fpMismatch?: boolean
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
