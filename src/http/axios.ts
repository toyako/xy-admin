import type { AxiosInstance, AxiosRequestConfig } from "axios"
import { getToken, setToken as _setToken } from "@@/utils/local-storage"
import axios from "axios"
import { get, merge } from "lodash-es"
import { useUserStore } from "@/pinia/stores/user"

/** Token 刷新状态管理 */
let isRefreshing = false
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pendingRequests: Array<(token: string) => void> = []

/** 处理等待中的请求队列 */
function onTokenRefreshed(newToken: string) {
  pendingRequests.forEach(callback => callback(newToken))
  pendingRequests = []
}

/** 将失败的请求加入等待队列 */
function addPendingRequest(): Promise<string> {
  return new Promise((resolve) => {
    pendingRequests.push((token: string) => resolve(token))
  })
}

/** 刷新 Token */
async function refreshToken(): Promise<string> {
  const token = getToken()
  if (!token) throw new Error("No token to refresh")
  // 使用独立 axios 实例避免拦截器循环
  const { data } = await axios.post(
    `${import.meta.env.VITE_BASE_URL}/auth/refresh`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const newToken = data?.data?.token || data?.token
  if (!newToken) throw new Error("Refresh token failed")
  _setToken(newToken)
  return newToken
}

/** 创建请求实例 */
function createInstance() {
  // 创建一个 axios 实例命名为 instance
  const instance = axios.create()
  // 请求拦截器
  instance.interceptors.request.use(
    // 发送之前
    config => config,
    // 发送失败
    error => Promise.reject(error)
  )
  // 响应拦截器（可根据具体业务作出相应的调整）
  instance.interceptors.response.use(
    (response) => {
      // apiData 是 api 返回的数据
      const apiData = response.data
      // 二进制数据则直接返回
      const responseType = response.config.responseType
      if (responseType === "blob" || responseType === "arraybuffer") return apiData
      // 这个 code 是和后端约定的业务 code
      const code = apiData.code
      // 如果没有 code, 代表这不是项目后端开发的 api
      if (code === undefined) {
        ElMessage.error("非本系统的接口")
        return Promise.reject(new Error("非本系统的接口"))
      }
      switch (code) {
        case 0:
          // 本系统采用 code === 0 来表示没有业务错误
          return apiData
        case 401:
          // Token 过期时 — 尝试刷新 Token
          return handleTokenExpired(response.config)
        default:
          // 不是正确的 code
          ElMessage.error(apiData.message || "Error")
          return Promise.reject(apiData)
      }
    },
    (error) => {
      // status 是 HTTP 状态码
      const status = get(error, "response.status")
      const message = get(error, "response.data.message")
      switch (status) {
        case 400:
          error.message = "请求错误"
          break
        case 401:
          // HTTP 401 — 尝试刷新 Token（避免重复处理）
          if (error.config?.url !== "auth/refresh") {
            return handleTokenExpired(error.config)
          }
          // 刷新 Token 本身返回 401，说明 refresh token 也过期了，直接登出
          useUserStore().logout()
          error.message = message || "登录已过期，请重新登录"
          break
        case 403:
          error.message = message || "拒绝访问"
          break
        case 404:
          error.message = "请求地址出错"
          break
        case 408:
          error.message = "请求超时"
          break
        case 500:
          error.message = "服务器内部错误"
          break
        case 501:
          error.message = "服务未实现"
          break
        case 502:
          error.message = "网关错误"
          break
        case 503:
          error.message = "服务不可用"
          break
        case 504:
          error.message = "网关超时"
          break
        case 505:
          error.message = "HTTP 版本不受支持"
          break
      }
      ElMessage.error(error.message)
      return Promise.reject(error)
    }
  )
  return instance
}

/** 处理 Token 过期的统一入口 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTokenExpired(config: any) {
  // 如果正在刷新中，将请求加入等待队列
  if (isRefreshing) {
    const token = await addPendingRequest()
    config.headers.Authorization = `Bearer ${token}`
    return instance(config)
  }
  // 开始刷新 Token
  isRefreshing = true
  try {
    const newToken = await refreshToken()
    // 通知所有等待的请求
    onTokenRefreshed(newToken)
    // 重试当前请求
    config.headers.Authorization = `Bearer ${newToken}`
    return instance(config)
  } catch {
    // 刷新失败，清空队列并登出
    pendingRequests = []
    useUserStore().logout()
    return Promise.reject(new Error("Token 刷新失败"))
  } finally {
    isRefreshing = false
  }
}

/** 创建请求方法 */
function createRequest(instance: AxiosInstance) {
  return <T>(config: AxiosRequestConfig): Promise<T> => {
    const token = getToken()
    // 默认配置
    const defaultConfig: AxiosRequestConfig = {
      // 接口地址
      baseURL: import.meta.env.VITE_BASE_URL,
      // 请求头
      headers: {
        // 携带 Token
        "Authorization": token ? `Bearer ${token}` : undefined,
        "Content-Type": "application/json"
      },
      // 请求体
      data: {},
      // 请求超时
      timeout: 15000,
      // 跨域请求时是否携带 Cookies
      withCredentials: false
    }
    // 将默认配置 defaultConfig 和传入的自定义配置 config 进行合并成为 mergeConfig
    const mergeConfig = merge(defaultConfig, config)
    return instance(mergeConfig)
  }
}

/** 用于请求的实例 */
const instance = createInstance()

/** 用于请求的方法 */
export const request = createRequest(instance)
