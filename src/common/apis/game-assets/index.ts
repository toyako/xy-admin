import { request } from "@/http/axios"

/** 表元信息（管理端列表） */
export interface GameAssetRow {
  key: string
  label: string
  /** 当前内容来源：db=库里 / file=部署机文件种子 / none=都没有 */
  source: "db" | "file" | "none"
  bytes: number | null
  updatedAt: string | null
  updatedBy: string | null
  /** 部署机上的文件种子是否存在（可「重置为文件种子」） */
  fileExists: boolean
  fileBytes: number | null
}

/** 某张表的完整内容 */
export interface GameAssetDetail {
  key: string
  label: string
  source: "db" | "file"
  value: string
  parsed: unknown
}

/** 响应包类型（与项目统一响应拦截器 ApiResponseData<T> 一致，见 types/api.d.ts） */
export type GameAssetListResponse = ApiResponseData<GameAssetRow[]>
export type GameAssetDetailResponse = ApiResponseData<GameAssetDetail>

/** 列表：所有关键数据表 */
export function listGameAssetsApi() {
  return request<GameAssetListResponse>({
    url: "admin/game-assets",
    method: "get"
  })
}

/** 取某张表内容（原文 JSON 字符串 + 解析结果） */
export function getGameAssetApi(key: string) {
  return request<GameAssetDetailResponse>({
    url: `admin/game-assets/${key}`,
    method: "get"
  })
}

/** 保存某张表（后端会校验合法 JSON） */
export function updateGameAssetApi(key: string, value: string) {
  return request({
    url: `admin/game-assets/${key}`,
    method: "put",
    data: { value }
  })
}

/** 重置为文件种子 */
export function resetGameAssetApi(key: string) {
  return request({
    url: `admin/game-assets/${key}/reset`,
    method: "post"
  })
}
