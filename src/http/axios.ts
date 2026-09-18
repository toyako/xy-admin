import type { AxiosInstance, AxiosRequestConfig } from "axios"
import { setToken as _setToken, getToken, removeToken } from "@@/utils/local-storage"
import axios from "axios"
import { get, merge } from "lodash-es"
import { useUserStore } from "@/pinia/stores/user"
import { shouldSkipAuthRefresh } from "./auth-retry-policy"

// 给 axios 的请求配置补上本项目自定义标记，供 api 层按需声明
declare module "axios" {
  export interface AxiosRequestConfig {
    /** 该接口不参与 token 刷新重试（登录/登出等自身就会返回 401 的接口） */
    skipAuthRefresh?: boolean
    /** 内部标记：本请求已因 token 过期重试过一次 */
    __isRetryRequest?: boolean
  }
}

/** Token 刷新状态管理 */
let isRefreshing = false
interface PendingResolver { resolve: (token: string) => void, reject: (error: Error) => void }
let pendingRequests: PendingResolver[] = []

/** 刷新成功：唤醒所有等待中的请求 */
function onTokenRefreshed(newToken: string) {
  pendingRequests.forEach(({ resolve }) => resolve(newToken))
  pendingRequests = []
}

/**
 * 刷新失败：必须 reject 掉等待中的请求。
 * 旧实现只清空数组不 reject，等待中的请求会永远挂起（页面一直 loading）。
 */
function onTokenRefreshFailed(error: Error) {
  pendingRequests.forEach(({ reject }) => reject(error))
  pendingRequests = []
}

/** 将失败的请求加入等待队列 */
function addPendingRequest(): Promise<string> {
  return new Promise((resolve, reject) => {
    pendingRequests.push({ resolve, reject })
  })
}

/** 给重试的请求换上新的 Authorization 头（兼容 AxiosHeaders 实例与普通对象） */

function setAuthHeader(config: any, token: string) {
  const value = `Bearer ${token}`
  if (typeof config.headers?.set === "function") {
    config.headers.set("Authorization", value)
  } else {
    config.headers = { ...(config.headers || {}), Authorization: value }
  }
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
          // 业务码 401（HTTP 200 + code 401）→ 与 HTTP 401 走同一套判定
          if (shouldSkipAuthRefresh(response.config)) {
            ElMessage.error(apiData.message || "未授权")
            return Promise.reject(apiData)
          }
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
        case 401: {
          // ⚠️ 关键分支（2026-09-18 修复"无限刷请求"死循环）：
          // 登录 / 登出 / 刷新这三个接口自身就会返回 401，一旦让它们进入刷新重试流程，
          // 就会出现 logout → 401 → 刷新失败 → logout → 401 的无限循环。
          if (shouldSkipAuthRefresh(error.config)) {
            error.message = message || "用户名或密码错误"
            break
          }
          return handleTokenExpired(error.config)
        }
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

async function handleTokenExpired(config: any) {
  const cfg = config || {}

  // ① 兜底再判一次：不参与刷新的接口 / 已重试过 → 直接失败，不再发起任何请求
  if (shouldSkipAuthRefresh(cfg)) {
    return Promise.reject(new Error("登录已过期，请重新登录"))
  }

  // ② 已有刷新在进行 → 排队等待，拿到新 token 后重试一次
  if (isRefreshing) {
    try {
      const token = await addPendingRequest()
      setAuthHeader(cfg, token)
      cfg.__isRetryRequest = true
      return await instance(cfg)
    } catch (e) {
      return Promise.reject(e)
    }
  }

  // ③ 由当前请求触发刷新
  isRefreshing = true
  try {
    const newToken = await refreshToken()
    onTokenRefreshed(newToken)
    setAuthHeader(cfg, newToken)
    cfg.__isRetryRequest = true
    return await instance(cfg)
  } catch {
    // 刷新失败 → 唤醒等待队列（reject，避免请求永久挂起）、清掉失效 token、只做本地登出
    onTokenRefreshFailed(new Error("登录已过期，请重新登录"))
    removeToken()
    // ⚠️ 必须传 false（只做本地清理）：
    //    这里若调用 logoutApi() 发 POST /auth/logout，会再拿一个 401，
    //    又回到响应拦截器 → 再次 logout → 无限循环。
    useUserStore().logout(false)
    ElMessage.error("登录已过期，请重新登录")
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
