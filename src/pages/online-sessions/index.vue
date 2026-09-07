<script lang="ts" setup>
import type {
  IpBanData,
  OnlineSessionData,
  OnlineSessionGroup
} from "@@/apis/online-sessions/type"
import {
  banIpApi,
  getDevicesByIpApi,
  getGroupedOnlineSessionsApi,
  getIpBansApi,
  unbanIpApi
} from "@@/apis/online-sessions"
import dayjs from "dayjs"

defineOptions({ name: "OnlineSessions" })

/** 一级行：IP 分组 */
interface GroupRow extends OnlineSessionGroup {
  key: string
  children: DeviceRow[]
}
/** 二级行：设备明细 */
interface DeviceRow extends OnlineSessionData {
  key: string
  isDevice: boolean
}

const loading = ref(false)
const tableData = ref<GroupRow[]>([])
const onlineCount = ref(0)
const totalCount = ref(0)
const ipCount = ref(0)
const bannedCount = ref(0)
const keyword = ref("")
/** 已展开的行 key（用于刷新后恢复展开态） */
const expandRowKeys = ref<string[]>([])
/** 已加载的设备缓存：ip -> 设备行 */
const childrenCache = ref<Record<string, DeviceRow[]>>({})

/** 封禁列表 */
const banDialogVisible = ref(false)
const banList = ref<IpBanData[]>([])
const banLoading = ref(false)

let refreshTimer: ReturnType<typeof setInterval> | null = null

/** 脱敏设备码：显示前4后4 */
function maskDeviceId(id: string): string {
  if (!id) return "-"
  if (id.length <= 8) return id
  return `${id.slice(0, 4)}****${id.slice(-4)}`
}

/** 脱敏 IP：显示前两段（完整 IP 悬浮可见） */
function maskIp(ip: string | null): string {
  if (!ip) return "-"
  const parts = ip.split(".")
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`
  if (ip.includes(":")) return `${ip.slice(0, 6)}...`
  return `${ip.slice(0, 3)}***`
}

/** 格式化在线时长 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return "刚刚"
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h} 小时 ${rm} 分钟`
}

/** 格式化心跳时间 */
function formatTime(time: string): string {
  return dayjs(time).format("HH:mm:ss")
}

/** 懒加载：展开时拉取该 IP 下的设备 */
async function loadDevices(row: GroupRow) {
  try {
    const { data } = await getDevicesByIpApi(row.ip)
    childrenCache.value[row.ip] = data.items.map(d => ({
      ...d,
      key: `dev:${d.id}`,
      isDevice: true
    }))
    row.children = childrenCache.value[row.ip]
  } catch {
    row.children = []
  }
}

/** 展开/收起：展开时懒加载，收起时保留缓存 */
function onExpandChange(row: GroupRow, arg: any) {
  // 树形展开时第二个参数为 boolean（Element Plus 运行时语义），类型声明为数组，此处兼容处理
  const expanded = typeof arg === "boolean" ? arg : Array.isArray(arg) && arg.some((r: any) => r?.key === row.key)
  if (expanded) {
    if (!expandRowKeys.value.includes(row.key)) {
      expandRowKeys.value = [...expandRowKeys.value, row.key]
    }
    if (row.children.length === 0) loadDevices(row)
  } else {
    expandRowKeys.value = expandRowKeys.value.filter(k => k !== row.key)
  }
}

async function fetchData() {
  loading.value = true
  try {
    const { data } = await getGroupedOnlineSessionsApi()
    onlineCount.value = data.onlineCount
    totalCount.value = data.total
    ipCount.value = data.ipCount
    bannedCount.value = data.bannedCount

    // 刷新已展开 IP 的设备明细
    const expandedIps = expandRowKeys.value.map(k => k.slice(3))
    await Promise.all(
      expandedIps.map(async (ip) => {
        try {
          const res = await getDevicesByIpApi(ip)
          childrenCache.value[ip] = res.data.items.map(d => ({
            ...d,
            key: `dev:${d.id}`,
            isDevice: true
          }))
        } catch { /* 保留旧数据 */ }
      })
    )

    tableData.value = data.groups.map(g => ({
      ...g,
      key: `ip:${g.ip}`,
      children: childrenCache.value[g.ip] || []
    }))
  } catch { /* */ } finally {
    loading.value = false
  }
}

/** 客户端搜索：按 IP / 设备名过滤 */
const filteredData = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return tableData.value
  return tableData.value.filter((g) => {
    if (g.ip.toLowerCase().includes(kw)) return true
    // 已加载的设备名/设备码/卡密也参与匹配
    return (childrenCache.value[g.ip] || []).some(
      d =>
        (d.deviceName || "").toLowerCase().includes(kw)
        || (d.deviceId || "").toLowerCase().includes(kw)
        || (d.cardCode || "").toLowerCase().includes(kw)
    )
  })
})

/** 禁用 IP */
async function handleBan(ip: string) {
  try {
    const { value } = await ElMessageBox.prompt(
      `封禁后该 IP 下的所有设备将无法验证卡密、心跳将被拒绝（客户端被踢下线）。`,
      `禁用 IP ${ip}`,
      {
        confirmButtonText: "确定封禁",
        cancelButtonText: "取消",
        inputPlaceholder: "封禁原因（可选）",
        inputType: "text",
        type: "warning"
      }
    )
    await banIpApi(ip, value || undefined)
    ElMessage.success("已封禁该 IP")
    await fetchData()
  } catch (e: any) {
    if (e !== "cancel" && e?.message) ElMessage.error(e.message)
  }
}

/** 解禁 IP */
async function handleUnban(ip: string) {
  try {
    await ElMessageBox.confirm(`确定解禁 IP ${ip}？解禁后该网络可正常使用。`, "提示", {
      type: "info"
    })
  } catch {
    return
  }
  try {
    await unbanIpApi(ip)
    ElMessage.success("已解禁")
    await fetchData()
    if (banDialogVisible.value) await fetchBanList()
  } catch (e: any) {
    ElMessage.error(e?.message || "操作失败")
  }
}

/** 封禁列表 */
async function fetchBanList() {
  banLoading.value = true
  try {
    const { data } = await getIpBansApi()
    banList.value = data.items
  } catch { /* */ } finally {
    banLoading.value = false
  }
}

function openBanDialog() {
  banDialogVisible.value = true
  fetchBanList()
}

// 每 10 秒自动刷新
onMounted(() => {
  fetchData()
  refreshTimer = setInterval(fetchData, 10000)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="app-container">
    <!-- 统计 -->
    <el-row :gutter="12" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #67c23a">
            {{ onlineCount }}
          </div>
          <div class="stat-label">
            当前在线
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #409eff">
            {{ ipCount }}
          </div>
          <div class="stat-label">
            IP 数
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #909399">
            {{ totalCount }}
          </div>
          <div class="stat-label">
            累计设备
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #f56c6c">
            {{ bannedCount }}
          </div>
          <div class="stat-label">
            已封禁 IP
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 表格 -->
    <el-card shadow="never">
      <div class="table-header">
        <span class="header-title">设备列表（按 IP 分组）</span>
        <div class="header-actions">
          <el-input
            v-model="keyword"
            placeholder="搜索 IP / 设备名 / 设备码 / 卡密"
            clearable
            size="small"
            style="width: 240px"
          />
          <el-button size="small" type="danger" plain @click="openBanDialog">
            封禁列表（{{ bannedCount }}）
          </el-button>
          <el-tag size="small" type="info">
            每 10 秒自动刷新
          </el-tag>
        </div>
      </div>
      <div class="table-wrapper">
        <el-table
          v-loading="loading"
          :data="filteredData"
          row-key="key"
          :expand-row-keys="expandRowKeys"
          :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
          stripe
          @expand-change="onExpandChange"
        >
          <!-- 树形列：IP / 设备 -->
          <el-table-column label="IP / 设备" min-width="280">
            <template #default="{ row }">
              <template v-if="row.isDevice">
                <span class="online-dot" :class="{ online: row.isOnline, offline: !row.isOnline }" />
                <span class="device-name">{{ row.deviceName || '-' }}</span>
              </template>
              <template v-else>
                <el-tooltip :content="row.ip" placement="top" :disabled="row.ip === '(未知)'">
                  <span class="ip-text">{{ row.ip === '(未知)' ? '未知 IP' : maskIp(row.ip) }}</span>
                </el-tooltip>
                <el-tag size="small" type="info" effect="plain" class="ml-6">
                  {{ row.deviceCount }} 台设备
                </el-tag>
                <el-tag v-if="row.banned" size="small" type="danger" effect="dark" class="ml-6">
                  已封禁
                </el-tag>
              </template>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <template v-if="row.isDevice">
                <span v-if="row.isOnline">{{ formatDuration(row.onlineDuration) }}</span>
                <span v-else style="color:#909399">离线</span>
              </template>
              <template v-else>
                <span style="color:#67c23a">在线 {{ row.onlineCount }}</span>
                <span style="color:#c0c4cc"> / {{ row.deviceCount }}</span>
              </template>
            </template>
          </el-table-column>

          <el-table-column label="设备码" width="150">
            <template #default="{ row }">
              <template v-if="row.isDevice">
                <el-tooltip :content="row.deviceId" placement="top" :disabled="!row.deviceId">
                  <code class="code-text">{{ maskDeviceId(row.deviceId) }}</code>
                </el-tooltip>
              </template>
              <span v-else style="color:#c0c4cc">-</span>
            </template>
          </el-table-column>

          <el-table-column label="卡密" width="150">
            <template #default="{ row }">
              <template v-if="row.isDevice">
                <code v-if="row.cardCode" class="code-text">{{ row.cardCode }}</code>
                <span v-else style="color:#909399">试用/未激活</span>
              </template>
              <span v-else style="color:#c0c4cc">-</span>
            </template>
          </el-table-column>

          <el-table-column label="最近心跳" width="110">
            <template #default="{ row }">
              <span v-if="!row.isDevice && row.lastHeartbeatAt">
                {{ dayjs(row.lastHeartbeatAt).format("MM-DD HH:mm") }}
              </span>
              <span v-else-if="row.isDevice">{{ formatTime(row.lastHeartbeatAt) }}</span>
              <span v-else style="color:#c0c4cc">-</span>
            </template>
          </el-table-column>

          <el-table-column label="首次出现" width="160">
            <template #default="{ row }">
              <span v-if="row.isDevice">{{ dayjs(row.createdAt).format("MM-DD HH:mm") }}</span>
              <span v-else-if="row.firstSeenAt">
                {{ dayjs(row.firstSeenAt).format("MM-DD HH:mm") }}
              </span>
              <span v-else style="color:#c0c4cc">-</span>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="120" align="center" fixed="right">
            <template #default="{ row }">
              <div v-if="row.banned">
                <el-button link type="success" size="small" @click="handleUnban(row.ip)">
                  解禁
                </el-button>
              </div>
              <div v-else-if="!row.isDevice && row.ip !== '(未知)'">
                <el-button link type="danger" size="small" @click="handleBan(row.ip)">
                  禁用此 IP
                </el-button>
              </div>
              <div v-else-if="row.isDevice && row.ip">
                <el-button link type="danger" size="small" @click="handleBan(row.ip)">
                  禁用其 IP
                </el-button>
              </div>
              <span v-else style="color:#c0c4cc">-</span>
            </template>
          </el-table-column>

          <template #empty>
            <span style="color:#909399">暂无设备</span>
          </template>
        </el-table>
      </div>
    </el-card>

    <!-- 封禁列表 -->
    <el-dialog v-model="banDialogVisible" title="IP 封禁列表" width="640px">
      <el-table v-loading="banLoading" :data="banList" size="small" max-height="420">
        <el-table-column prop="ip" label="IP" width="160" />
        <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.reason || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="封禁时间" width="160">
          <template #default="{ row }">
            {{ dayjs(row.createdAt).format("YYYY-MM-DD HH:mm") }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button link type="success" size="small" @click="handleUnban(row.ip)">
              解禁
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <span style="color:#909399">暂无封禁记录</span>
        </template>
      </el-table>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.app-container {
  padding: 16px;
}
.stats-row {
  margin-bottom: 16px;
}
.stat-card {
  text-align: center;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.header-title {
  font-size: 15px;
  font-weight: 600;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.table-wrapper {
  .code-text {
    font-family: "Consolas", monospace;
    font-size: 13px;
    color: var(--el-color-primary);
  }
  .ip-text {
    font-family: "Consolas", monospace;
  }
  .device-name {
    margin-left: 6px;
  }
  .ml-6 {
    margin-left: 6px;
  }
}
.online-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  &.online {
    background-color: #67c23a;
    box-shadow: 0 0 4px #67c23a;
  }
  &.offline {
    background-color: #c0c4cc;
  }
}
</style>
