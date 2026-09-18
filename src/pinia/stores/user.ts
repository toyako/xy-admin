import { getCurrentUserApi, logoutApi } from "@@/apis/users"
import { setToken as _setToken, getToken, removeToken } from "@@/utils/local-storage"
import { pinia } from "@/pinia"
import { resetRouter, router } from "@/router"
import { useSettingsStore } from "./settings"
import { useTagsViewStore } from "./tags-view"

export const useUserStore = defineStore("user", () => {
  const token = ref<string>(getToken() || "")

  const roles = ref<string[]>([])

  const permissions = ref<string[]>([])

  const username = ref<string>("")

  const isGotUserInfo = ref<boolean>(false)

  const tagsViewStore = useTagsViewStore()

  const settingsStore = useSettingsStore()

  // 设置 Token
  const setToken = (value: string) => {
    _setToken(value)
    token.value = value
  }

  // 获取用户详情
  const getInfo = async () => {
    const { data } = await getCurrentUserApi()
    username.value = data.username
    roles.value = data.roles ?? []
    permissions.value = data.permissions ?? []
    // 防止路由守卫逻辑进入无限循环
    isGotUserInfo.value = true
  }

  // 模拟用户变化（仅开发环境可用，生产环境禁用以防滥用）
  const changeUser = (value: string) => {
    if (!import.meta.env.DEV) return
    const newToken = `token-${value}`
    token.value = newToken
    _setToken(newToken)
    // 用刷新页面代替重新登录
    location.reload()
  }

  /**
   * 登出
   * @param callServer 是否通知后端废弃 Token。默认 true（用户主动点「退出登录」时）。
   *   ⚠️ token 已失效的兜底路径**必须传 false**：此时调 /auth/logout 只会再拿一个 401，
   *   被响应拦截器捕获后又调用 logout()，形成无限刷请求的死循环（2026-09-18 修复）。
   */
  const logout = (callServer = true) => {
    if (callServer) {
      // 通知后端废弃 Token（best-effort，不阻塞登出流程）
      logoutApi().catch(() => { /* 忽略网络错误，本地状态仍会清理 */ })
    }
    resetToken()
    resetRouter()
    resetTagsView()
    // 重定向到登录页（已在登录页则跳过，避免重复导航）
    if (router.currentRoute.value.path !== "/login") {
      router.replace("/login")
    }
  }

  // 重置 Token
  const resetToken = () => {
    removeToken()
    token.value = ""
    roles.value = []
    permissions.value = []
    username.value = ""
    isGotUserInfo.value = false
  }

  // 重置 Visited Views 和 Cached Views
  const resetTagsView = () => {
    if (!settingsStore.cacheTagsView) {
      tagsViewStore.delAllVisitedViews()
      tagsViewStore.delAllCachedViews()
    }
  }

  return { token, roles, permissions, username, isGotUserInfo, setToken, getInfo, changeUser, logout, resetToken }
})

/**
 * @description 在 SPA 应用中可用于在 pinia 实例被激活前使用 store
 * @description 在 SSR 应用中可用于在 setup 外使用 store
 */
export function useUserStoreOutside() {
  return useUserStore(pinia)
}
