<script lang="ts" setup>
import type { OnlineSessionData } from "@@/apis/online-sessions/type"
import { getOnlineSessionsApi } from "@@/apis/online-sessions"
import dayjs from "dayjs"

defineOptions({ name: "OnlineSessions" })

const loading = ref(false)
const tableData = ref<OnlineSessionData[]>([])
const onlineCount = ref(0)
const totalCount = ref(0)
let refreshTimer: ReturnType<typeof setInterval> | null = null

/** 脱敏设备码：显示前4后4 */
function maskDeviceId(id: string): string {
  if (!id) return '-'
  if (id.length <= 8) return id
  return id.slice(0, 4) + '****' + id.slice(-4)
}

/** 脱敏 IP */
function maskIp(ip: string | null): string {
  if (!ip) return '-'
  const parts = ip.split('.')
  if (parts.length === 4) return parts[0] + '.' + parts[1] + '.*.*'
  if (ip.includes(':')) return ip.slice(0, 6) + '...'
  return ip.slice(0, 3) + '***'
}

/** 格式化在线时长 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return '刚刚'
  const m = Math.floor(seconds / 60)
  if (m < 60) return m + ' 分钟'
  const h = Math.floor(m / 60)
  const rm = m % 60
  return h + ' 小时 ' + rm + ' 分钟'
}

/** 格式化心跳时间 */
function formatTime(time: string): string {
  return dayjs(time).format("HH:mm:ss")
}

async function fetchData() {
  loading.value = true
  try {
    const { data } = await getOnlineSessionsApi()
    tableData.value = data.items
    onlineCount.value = data.onlineCount
    totalCount.value = data.total
  } catch { /* */ }
  finally { loading.value = false }
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
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #67c23a">{{ onlineCount }}</div>
          <div class="stat-label">当前在线</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #909399">{{ totalCount - onlineCount }}</div>
          <div class="stat-label">历史离线</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #409eff">{{ totalCount }}</div>
          <div class="stat-label">累计设备</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 表格 -->
    <el-card shadow="never">
      <div class="table-header">
        <span class="header-title">设备列表</span>
        <el-tag size="small" type="info">每 10 秒自动刷新</el-tag>
      </div>
      <div class="table-wrapper">
        <el-table v-loading="loading" :data="tableData" stripe>
          <el-table-column label="状态" width="70" align="center">
            <template #default="{ row }">
              <span class="online-dot" :class="{ online: row.isOnline, offline: !row.isOnline }" />
            </template>
          </el-table-column>
          <el-table-column label="设备名称" width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.deviceName || '-' }}</template>
          </el-table-column>
          <el-table-column label="设备码" width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <el-tooltip :content="row.deviceId" placement="top" :disabled="!row.deviceId">
                <code class="code-text">{{ maskDeviceId(row.deviceId) }}</code>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="IP 地址" width="130" show-overflow-tooltip>
            <template #default="{ row }">
              <el-tooltip :content="row.ip || ''" placement="top" :disabled="!row.ip">
                <span>{{ maskIp(row.ip) }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="卡密" width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <code v-if="row.cardCode" class="code-text">{{ row.cardCode }}</code>
              <span v-else style="color:#909399">试用/未激活</span>
            </template>
          </el-table-column>
          <el-table-column label="在线时长" width="110">
            <template #default="{ row }">
              <span v-if="row.isOnline">{{ formatDuration(row.onlineDuration) }}</span>
              <span v-else style="color:#909399">离线</span>
            </template>
          </el-table-column>
          <el-table-column label="上线时间" width="100">
            <template #default="{ row }">{{ formatTime(row.lastHeartbeatAt) }}</template>
          </el-table-column>
          <el-table-column label="首次出现" width="160">
            <template #default="{ row }">{{ dayjs(row.createdAt).format("MM-DD HH:mm") }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
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
.table-wrapper {
  .code-text {
    font-family: 'Consolas', monospace;
    font-size: 13px;
    color: var(--el-color-primary);
  }
}
.online-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  &.online { background-color: #67c23a; box-shadow: 0 0 4px #67c23a; }
  &.offline { background-color: #c0c4cc; }
}
</style>
