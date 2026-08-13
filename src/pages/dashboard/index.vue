<script lang="ts" setup>
import { getCardsStatsApi } from "@@/apis/cards"
import { getOnlineSessionsApi } from "@@/apis/online-sessions"
import { getOrdersApi, getOrdersStatsApi } from "@@/apis/orders"
import dayjs from "dayjs"
import { onMounted, ref } from "vue"

defineOptions({ name: "Dashboard" })

const loading = ref(false)
const orderStats = ref<any>({})
const cardStats = ref<any>({})
const onlineCount = ref(0)
const recentOrders = ref<any[]>([])

const cardTypeMap: Record<string, string> = { minute: "分钟卡", hour: "小时卡", day: "日卡", month: "月卡", quarter: "季卡", year: "年卡", lifetime: "永久卡" }
const orderStatusMap: Record<string, string> = { pending: "待支付", paid: "已支付", cancelled: "已取消", expired: "已过期" }
const statusTagMap: Record<string, "info" | "warning" | "success" | "danger"> = { pending: "warning", paid: "success", cancelled: "info", expired: "danger" }

function formatMoney(cents: number) {
  return (cents / 100).toFixed(2)
}

async function loadData() {
  loading.value = true
  try {
    const [os, cs, ss, recent] = await Promise.all([
      getOrdersStatsApi().then((r: any) => r.data || {}).catch(() => ({})),
      getCardsStatsApi().then((r: any) => r.data || {}).catch(() => ({})),
      getOnlineSessionsApi().then((r: any) => r.data || {}).catch(() => ({})),
      getOrdersApi({ currentPage: 1, size: 8, status: undefined })
        .then((r: any) => r.data?.items || [])
        .catch(() => [])
    ])
    orderStats.value = os
    cardStats.value = cs
    onlineCount.value = ss?.onlineCount || 0
    recentOrders.value = recent
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="dashboard-container" v-loading="loading">
    <!-- 订单统计 -->
    <el-row :gutter="16">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #67c23a">
            ¥{{ formatMoney(orderStats.totalAmount || 0) }}
          </div>
          <div class="stat-label">
            累计收入
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #409eff">
            {{ orderStats.todayOrders || 0 }}
          </div>
          <div class="stat-label">
            今日成交
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #67c23a">
            {{ orderStats.paid || 0 }}
          </div>
          <div class="stat-label">
            已支付订单
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #e6a23c">
            {{ orderStats.pending || 0 }}
          </div>
          <div class="stat-label">
            待支付订单
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 卡密 + 在线设备 -->
    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #6366f1">
            {{ cardStats.all || 0 }}
          </div>
          <div class="stat-label">
            卡密总量
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #00b578">
            {{ cardStats.unused || 0 }}
          </div>
          <div class="stat-label">
            未使用卡密
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #13c2c2">
            {{ cardStats.activated || 0 }}
          </div>
          <div class="stat-label">
            已激活设备
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #722ed1">
            {{ onlineCount }}
          </div>
          <div class="stat-label">
            在线设备
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最近订单 -->
    <el-card shadow="never" class="recent-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">最近订单</span>
          <router-link to="/orders" class="more-link">
            查看全部 →
          </router-link>
        </div>
      </template>
      <el-table :data="recentOrders" stripe size="small">
        <el-table-column prop="orderNo" label="订单号" width="170" show-overflow-tooltip />
        <el-table-column label="套餐" width="90">
          <template #default="{ row }">
            {{ cardTypeMap[row.cardType] || row.cardType }}
          </template>
        </el-table-column>
        <el-table-column label="金额" width="90">
          <template #default="{ row }">
            ¥{{ formatMoney(row.amount) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.status]" size="small">
              {{ orderStatusMap[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="卡密" min-width="140">
          <template #default="{ row }">
            <code v-if="row.cardCode" class="card-code">{{ row.cardCode }}</code>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="150">
          <template #default="{ row }">
            {{ dayjs(row.createdAt).format("MM-DD HH:mm") }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.dashboard-container {
  padding: 16px;
}
.stat-card {
  text-align: center;
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
.recent-card {
  margin-top: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-weight: 600;
  font-size: 15px;
}
.more-link {
  font-size: 13px;
  color: #409eff;
  text-decoration: none;
}
.card-code {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: #409eff;
  background: rgba(64, 158, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
