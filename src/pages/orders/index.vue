<script lang="ts" setup>
import type { OrderData } from "@@/apis/orders/type"
import { confirmOrderApi, getOrdersApi, getOrdersStatsApi } from "@@/apis/orders"
import { usePagination } from "@@/composables/usePagination"
import dayjs from "dayjs"

defineOptions({ name: "OrdersManage" })

const loading = ref(false)
const tableData = ref<OrderData[]>([])
const stats = ref<any>({})

// 分页
const { paginationData, resetCurrentPage, watchPagination } = usePagination({ callback: getTableData })

// 搜索
const searchData = reactive({ status: "" })

const cardTypeMap: Record<string, string> = { minute: "分钟卡", hour: "小时卡", day: "日卡", month: "月卡", quarter: "季卡", year: "年卡", lifetime: "永久卡" }
const orderStatusMap: Record<string, string> = { pending: "待支付", paid: "已支付", cancelled: "已取消", expired: "已过期" }
const statusTagMap: Record<string, "info" | "warning" | "success" | "danger"> = { pending: "warning", paid: "success", cancelled: "info", expired: "danger" }

function formatMoney(cents: number) {
  return (cents / 100).toFixed(2)
}

async function getTableData() {
  loading.value = true
  try {
    const { data } = await getOrdersApi({
      currentPage: paginationData.currentPage!,
      size: paginationData.pageSize!,
      status: searchData.status || undefined
    })
    tableData.value = data.items
    paginationData.total = data.total
  } catch { /* */ } finally {
    loading.value = false
  }
}

async function getStats() {
  try {
    const { data } = await getOrdersStatsApi()
    stats.value = data
  } catch { /* */ }
}

function handleSearch() {
  resetCurrentPage()
}
function resetSearch() {
  searchData.status = ""
  handleSearch()
}

/** 手动确认支付（补单：回调失败时手动完成并发放卡密） */
async function handleConfirm(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认手动完成订单 ${row.orderNo} 并发放卡密？\n（仅用于支付回调失败的补单，请先核实买家确已付款）`,
      "手动确认支付",
      { type: "warning", confirmButtonText: "确认补单", cancelButtonText: "取消" }
    )
  } catch {
    return
  }
  try {
    await confirmOrderApi(row.orderNo)
    ElMessage.success("补单成功，卡密已发放")
    getTableData()
    getStats()
  } catch (e: any) {
    ElMessage.error(e?.message || "补单失败")
  }
}

watchPagination()
onMounted(() => getStats())
</script>

<template>
  <div class="app-container">
    <!-- 统计 -->
    <el-row :gutter="12" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #909399">
            {{ stats.paid || 0 }}
          </div>
          <div class="stat-label">
            已支付订单
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #e6a23c">
            {{ stats.pending || 0 }}
          </div>
          <div class="stat-label">
            待支付订单
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #67c23a">
            {{ formatMoney(stats.totalAmount || 0) }}
          </div>
          <div class="stat-label">
            总收入 (元)
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #409eff">
            {{ stats.todayOrders || 0 }}
          </div>
          <div class="stat-label">
            今日成交
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索 -->
    <el-card shadow="never" class="search-wrapper">
      <el-form :inline="true" :model="searchData">
        <el-form-item label="状态">
          <el-select v-model="searchData.status" clearable placeholder="全部" style="width: 150px">
            <el-option v-for="(label, value) in orderStatusMap" :key="value" :label="label" :value="value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            查询
          </el-button>
          <el-button @click="resetSearch">
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <div class="table-wrapper">
        <el-table v-loading="loading" :data="tableData" stripe>
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="orderNo" label="订单号" width="180" />
          <el-table-column label="套餐" width="80">
            <template #default="{ row }">
              {{ cardTypeMap[row.cardType] || row.cardType }}
            </template>
          </el-table-column>
          <el-table-column label="金额" width="100">
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
          <el-table-column prop="tradeNo" label="交易号" width="200" show-overflow-tooltip />
          <el-table-column label="卡密" min-width="150">
            <template #default="{ row }">
              <template v-if="row.cardCode">
                <code class="card-code">{{ row.cardCode }}</code>
              </template>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="160">
            <template #default="{ row }">
              {{ dayjs(row.createdAt).format("YYYY-MM-DD HH:mm") }}
            </template>
          </el-table-column>
          <el-table-column label="支付时间" width="160">
            <template #default="{ row }">
              {{ row.paidAt ? dayjs(row.paidAt).format("YYYY-MM-DD HH:mm") : "-" }}
            </template>
          </el-table-column>
          <el-table-column prop="buyerInfo" label="买家信息" min-width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'pending' || row.status === 'expired'"
                type="warning"
                link
                size="small"
                @click="handleConfirm(row)"
              >
                手动确认支付
              </el-button>
              <span v-else class="op-note">-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="pager-wrapper">
        <el-pagination
          v-model:current-page="paginationData.currentPage"
          v-model:page-size="paginationData.pageSize"
          :page-sizes="paginationData.pageSizes"
          :total="paginationData.total"
          :layout="paginationData.layout"
          background
          @size-change="handleSearch"
          @current-change="getTableData"
        />
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
.search-wrapper {
  margin-bottom: 16px;
  :deep(.el-card__body) {
    padding-bottom: 0;
  }
}
.pager-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.card-code {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: #409eff;
  background: rgba(64, 158, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  word-break: break-all;
}
.op-note {
  color: #c0c4cc;
  font-size: 12px;
}
</style>
