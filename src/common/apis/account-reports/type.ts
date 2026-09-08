/** 角色节点（区服行 children） */
export interface RoleNode {
  id?: string
  name?: string
  lvl?: number
  /** 🔒 角色锁状态（2026-09-08：0x7605 上报，后台只显示标记不显示密码明文） */
  locked?: boolean
  banned: boolean
  banReason: string | null
}

/** 区服节点（账号行 children） */
export interface ServerNode {
  serverLabel: string
  cardCode: string | null
  roles: RoleNode[]
  firstSeenAt: string
  lastSeenAt: string
}

/** 账号节点（设备行 children） */
export interface AccountNode {
  gameAccount: string
  servers: ServerNode[]
  banned: boolean
  banReason: string | null
}

/** 设备子树：设备 → 账号 → 区服 → 角色 */
export interface DeviceTree {
  deviceId: string
  online: boolean
  banned: boolean
  banReason: string | null
  cards: string[]
  accounts: AccountNode[]
}

/** 顶层设备节点（listDevices 一次返回完整嵌套树） */
export interface DeviceNode {
  deviceId: string
  accountCount: number
  serverCount: number
  roleCount: number
  cardCount: number
  firstSeenAt: string
  lastSeenAt: string
  online: boolean
  banned: boolean
  banReason: string | null
  accounts: AccountNode[]
}

export type DeviceListResponseData = ApiResponseData<{
  items: DeviceNode[]
  total: number
}>

export type DeviceTreeResponseData = ApiResponseData<DeviceTree>

/** 封禁记录 */
export interface AccountBanData {
  id: number
  targetType: "account" | "device" | "card" | "role"
  targetValue: string
  reason: string | null
  bannedBy: string | null
  createdAt: string
}

export type AccountBanListResponseData = ApiResponseData<{
  items: AccountBanData[]
  total: number
}>

export type BanResponseData = ApiResponseData<{
  success: boolean
  added: number
}>

/** 清空玩家上报数据响应 */
export type ClearPlayersResponseData = ApiResponseData<{
  success: boolean
  deleted: number
}>
