<script lang="ts" setup>
import type { CardData, GenerateCardsRequestData } from "@@/apis/cards/type"
import type { PlanItem } from "@@/apis/plans"
import type { FormRules } from "element-plus"
import { batchRemoveCardsApi, disableCardApi, generateCardsApi, getCardByOrderApi, getCardsApi, getCardsStatsApi, removeCardApi, replaceCardApi } from "@@/apis/cards"
import { getPlansApi } from "@@/apis/plans"
import { usePagination } from "@@/composables/usePagination"
import dayjs from "dayjs"

defineOptions({ name: "CardsManage" })

const loading = ref(false)
const tableData = ref<any[]>([])
const stats = ref<any>({})
const dialogVisible = ref(false)

// 分页（外层根卡分页；树形子卡不参与分页）
const { paginationData, resetCurrentPage, watchPagination } = usePagination({ callback: getTableData })

// 搜索
const searchData = reactive({ status: "", code: "", batchNote: "" })

// 套餐列表（类型下拉动态来源）
const plans = ref<PlanItem[]>([])
const cardTypeMap = ref<Record<string, string>>({ minute: "分钟卡", hour: "小时卡", day: "日卡", month: "月卡", quarter: "季卡", year: "年卡", lifetime: "永久卡" })
const dayPresets = ref<Record<string, number>>({ minute: 1 / 1440, hour: 1 / 24, day: 1, month: 30, quarter: 90, year: 365, lifetime: 36500 })
async function loadPlans() {
  try {
    const { data } = await getPlansApi()
    const list = data || []
    plans.value = list
    const map: Record<string, string> = {}
    const days: Record<string, number> = {}
    for (const p of list) {
      map[p.type] = p.name
      days[p.type] = p.days
    }
    if (Object.keys(map).length > 0) {
      cardTypeMap.value = { ...cardTypeMap.value, ...map }
      dayPresets.value = { ...dayPresets.value, ...days }
    }
    // 默认选中第一个启用的套餐
    const first = list.find((p: PlanItem) => p.enabled)
    if (first) {
      DEFAULT_FORM.type = first.type
      DEFAULT_FORM.days = first.days
    }
  } catch { /* 保留静态映射兜底 */ }
}
const cardStatusMap: Record<string, string> = { unused: "未使用", sold: "已售出", activated: "已激活", disabled: "已禁用", replaced: "已换卡", expired: "已过期" }
const tagMap: Record<string, "info" | "warning" | "success" | "danger"> = { unused: "info", sold: "warning", activated: "success", disabled: "danger", replaced: "danger", expired: "danger" }

/** 有效状态：activated + expiresAt 已过 → 显示"已过期"（前端动态判断，避免后端再发 SQL） */
function effectiveStatus(row: any): string {
  if (row.status === "activated" && row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) {
    return "expired"
  }
  return row.status
}

// 生成卡密表单
const DEFAULT_FORM: GenerateCardsRequestData = { type: "month", days: 30, count: 10, batchNote: "" }
const formData = ref<GenerateCardsRequestData>({ ...DEFAULT_FORM })
const formRef = useTemplateRef("formRef")
const formLoading = ref(false)
const formRules: FormRules = {
  type: [{ required: true, message: "请选择类型", trigger: "change" }],
  days: [{ required: true, type: "number", min: 0.0001, message: "天数需大于0", trigger: "blur" }],
  count: [
    { required: true, message: "请输入数量", trigger: "blur" },
    { type: "number", min: 1, max: 1000, message: "1~1000", trigger: "blur" }
  ]
}

function formatCode(raw: string): string {
  if (!raw) return ""
  const clean = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase()
  if (clean.length === 16) return clean.match(/.{1,4}/g)?.join("-") || raw
  return raw
}

/** 脱敏机器码：显示前4位...后4位 */
function maskMachineCode(code: string | null): string {
  if (!code) return "-"
  if (code.length <= 8) return code
  return `${code.slice(0, 4)}****${code.slice(-4)}`
}

/** 脱敏 IP 地址：保留前两段，后两段替换为 * */
function maskIp(ip: string | null): string {
  if (!ip) return "-"
  const parts = ip.split(".")
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`
  if (ip.includes(":")) {
    // IPv6：保留前两组
    const segments = ip.split(":")
    const masked = `${segments.slice(0, 2).join(":")}:***`
    if (masked.length > 15) return `${masked.slice(0, 18)}...`
    return masked
  }
  return `${ip.slice(0, 3)}***`
}

// 获取表格数据：外层根卡分页 + 换卡子卡全量挂载（树形）
async function getTableData() {
  loading.value = true
  try {
    const [rootRes, childRes] = await Promise.all([
      getCardsApi({
        currentPage: paginationData.currentPage!,
        size: paginationData.pageSize!,
        status: searchData.status || undefined,
        code: searchData.code || undefined,
        batchNote: searchData.batchNote || undefined,
        only: "root"
      }),
      getCardsApi({ currentPage: 1, size: 5000, only: "children" })
    ])
    // 子卡按 replaceFromId 挂到对应父卡（只有当前页的父卡能挂上）
    const roots = rootRes.data.items
    const children = childRes.data.items
    const childMap = new Map<number, any[]>()
    children.forEach((c: any) => {
      if (c.replaceFromId == null) return
      if (!childMap.has(c.replaceFromId)) childMap.set(c.replaceFromId, [])
      childMap.get(c.replaceFromId)!.push(c)
    })
    tableData.value = roots.map((r: any) => ({
      ...r,
      children: childMap.get(r.id) || []
    }))
    paginationData.total = rootRes.data.total
  } catch { /* 错误已由拦截器处理 */ } finally {
    loading.value = false
  }
}

// 获取统计
async function getStats() {
  try {
    const { data } = await getCardsStatsApi()
    stats.value = data
  } catch { /* */ }
}

// 搜索
function handleSearch() {
  resetCurrentPage()
}
function resetSearch() {
  searchData.status = ""
  searchData.code = ""
  searchData.batchNote = ""
  handleSearch()
}

// 生成卡密
function openDialog() {
  formData.value = { ...DEFAULT_FORM }
  dialogVisible.value = true
}
function onTypeChange(type: string) {
  const preset = dayPresets.value[type]
  if (preset !== undefined) formData.value.days = preset
}
function formatDaysHint(days: number): string {
  if (!days || days <= 0) return ""
  if (days < 1) {
    const mins = Math.round(days * 1440)
    const hrs = Math.round(days * 24)
    if (mins === 1) return "≈ 1分钟"
    if (hrs === 1) return "≈ 1小时"
    if (mins < 60) return `≈ ${mins}分钟`
    return `≈ ${hrs.toFixed(1)}小时`
  }
  if (days === 1) return "= 1天"
  if (days >= 36500) return "= 永久"
  return `= ${days}天`
}

/** 表格天数格式化：天卡正常显示"30天"，小时卡"1小时"，分钟卡"4分钟"，永久卡"永久"；非整天保留 1 位小数 */
function formatDays(days: number): string {
  if (!days || days <= 0) return "-"
  if (days >= 36500) return "永久"
  if (days >= 1) return `${Math.round(days * 10) / 10} 天`
  const hours = days * 24
  if (hours >= 1) return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`
  return `${Math.round(days * 1440)} 分钟`
}
async function handleGenerate() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  formLoading.value = true
  try {
    await generateCardsApi(formData.value)
    ElMessage.success("生成成功")
    dialogVisible.value = false
    getTableData()
    getStats()
  } catch { /* */ } finally {
    formLoading.value = false
  }
}

// 禁用（任何状态均可）
async function handleDisable(row: any) {
  const card = row as CardData
  await ElMessageBox.confirm(`确定禁用卡密 ${formatCode(card.code)}？`, "提示", { type: "warning" })
  try {
    await disableCardApi(card.id)
    ElMessage.success("已禁用")
    getTableData()
  } catch { /* */ }
}

// 删除单张（任何状态均可，强确认）
async function handleRemove(row: any) {
  const card = row as CardData
  const active = card.status === "activated" || card.status === "sold"
  try {
    await ElMessageBox.confirm(
      active
        ? `⚠️ 该卡密${card.status === "activated" ? "已被用户使用" : "已售出"}！\n删除后用户将无法验证此卡密。\n\n卡密：${formatCode(card.code)}\n建议：用户卡失效应使用「换卡」功能转移剩余时间。\n\n确定仍要删除吗？`
        : `确定删除卡密 ${formatCode(card.code)}？`,
      "删除卡密",
      { type: "warning", confirmButtonText: "确定删除", cancelButtonText: "取消" }
    )
  } catch {
    return
  }
  try {
    await removeCardApi(card.id)
    ElMessage.success("已删除")
    getTableData()
    getStats()
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败")
  }
}

/** 剩余时间格式化 */
function formatRemaining(ms: number | null): string {
  if (ms === null) return "-"
  if (ms <= 0) return "已过期"
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins} 分钟`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时 ${mins % 60} 分钟`
  const days = Math.floor(hours / 24)
  const h = hours % 24
  return `${days} 天${h ? ` ${h} 小时` : ""}`
}

/** 换卡/补卡：原卡剩余时间转移到新卡，原卡作废（最多 5 次） */
async function handleReplace(row: any, fromOrder = false) {
  const card = row
  if (card.status !== "activated") {
    ElMessage.warning("仅已激活的卡密可换卡")
    return
  }
  const remaining = card.expiresAt ? new Date(card.expiresAt).getTime() - Date.now() : 0
  if (remaining <= 0) {
    ElMessage.warning("该卡密已过期，无法换卡，请重新购买")
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定为该卡密换卡？\n卡密：${formatCode(card.code)}\n剩余时间：${formatRemaining(remaining)}\n\n换卡后：原卡立即作废，生成一张新卡（剩余时间自动转移）。\n新卡将作为原卡的子节点展示在列表中。`,
      "换卡 / 补卡",
      { type: "warning", confirmButtonText: "确认换卡", cancelButtonText: "取消" }
    )
  } catch {
    return
  }
  try {
    const res: any = await replaceCardApi(card.id)
    const newCode = res?.data?.code || ""
    ElMessage.success(`换卡成功！新卡：${formatCode(newCode)}（已复制）`)
    if (newCode) {
      try {
        await navigator.clipboard.writeText(newCode)
      } catch { /* */ }
    }
    getTableData()
    getStats()
    if (fromOrder) handleQueryOrder()
  } catch (e: any) {
    ElMessage.error(e?.message || "换卡失败")
  }
}

// 订单号查询（后台专用）
const orderQuery = reactive({ orderNo: "", result: null as any, loading: false, msg: "" })
async function handleQueryOrder() {
  const no = orderQuery.orderNo.trim()
  if (!no) {
    ElMessage.warning("请输入订单号")
    return
  }
  orderQuery.loading = true
  orderQuery.msg = ""
  orderQuery.result = null
  try {
    const { data } = await getCardByOrderApi(no) as any
    orderQuery.result = data
    if (!data?.card) orderQuery.msg = "订单已支付但未关联卡密（可能还在处理中）"
  } catch (e: any) {
    orderQuery.msg = e?.message || "查询失败"
  } finally {
    orderQuery.loading = false
  }
}

// 批量删除
const selectedIds = ref<number[]>([])
function onSelectionChange(rows: any[]) {
  selectedIds.value = rows.map(r => r.id)
}
async function handleBatchRemove() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请先勾选要删除的卡密")
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedIds.value.length} 张卡密？\n（已售出/已激活的会自动跳过）`,
      "批量删除",
      { type: "warning" }
    )
  } catch {
    return
  }
  try {
    const res: any = await batchRemoveCardsApi(selectedIds.value)
    const d = res?.data || {}
    ElMessage.success(`删除 ${d.deleted ?? 0} 张，跳过 ${d.skipped ?? 0} 张`)
    selectedIds.value = []
    getTableData()
    getStats()
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败")
  }
}

// 导出到剪贴板
async function handleExport(row: any) {
  const card = row as CardData
  await navigator.clipboard.writeText(card.code)
  ElMessage.success("已复制到剪贴板")
}

watchPagination()
onMounted(() => {
  getStats()
  loadPlans()
  getTableData()
})
</script>

<template>
  <div class="app-container">
    <!-- 统计卡片 -->
    <el-row :gutter="12" class="stats-row">
      <el-col
        v-for="item in [
          { label: '总计', key: 'all', color: '#909399' },
          { label: '未使用', key: 'unused', color: '#409eff' },
          { label: '已售出', key: 'sold', color: '#e6a23c' },
          { label: '已激活', key: 'activated', color: '#67c23a' },
          { label: '已禁用', key: 'disabled', color: '#f56c6c' },
          { label: '已换卡', key: 'replaced', color: '#b45309' },
        ]" :key="item.key" :span="4"
      >
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" :style="{ color: item.color }">
            {{ stats[item.key] || 0 }}
          </div>
          <div class="stat-label">
            {{ item.label }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索 -->
    <el-card shadow="never" class="search-wrapper">
      <el-form :inline="true" :model="searchData">
        <el-form-item label="状态">
          <el-select v-model="searchData.status" clearable placeholder="全部" style="width: 130px">
            <el-option v-for="(label, value) in cardStatusMap" :key="value" :label="label" :value="value" />
          </el-select>
        </el-form-item>
        <el-form-item label="卡密">
          <el-input v-model="searchData.code" placeholder="搜索卡密" clearable />
        </el-form-item>
        <el-form-item label="批次">
          <el-input v-model="searchData.batchNote" placeholder="搜索批次备注" clearable />
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
      <div class="toolbar-wrapper">
        <el-button type="primary" @click="openDialog">
          生成卡密
        </el-button>
        <el-button type="danger" plain :disabled="selectedIds.length === 0" @click="handleBatchRemove">
          批量删除{{ selectedIds.length ? `（${selectedIds.length}）` : "" }}
        </el-button>
        <div class="toolbar-spacer" />
        <!-- 订单号查询（后台换卡/补卡用） -->
        <div class="order-query">
          <el-input
            v-model="orderQuery.orderNo"
            placeholder="输入订单号查卡密（换卡用）"
            clearable
            style="width: 260px"
            @keyup.enter="handleQueryOrder"
          />
          <el-button type="primary" plain :loading="orderQuery.loading" @click="handleQueryOrder">
            查询订单
          </el-button>
        </div>
      </div>
      <div v-if="orderQuery.result" class="order-query-result">
        <template v-if="orderQuery.result.card">
          <span class="oq-item">
            订单 <code>{{ orderQuery.result.order.orderNo }}</code>
            （{{ cardStatusMap[effectiveStatus(orderQuery.result.card)] }}）
          </span>
          <span class="oq-item">
            卡密 <code class="oq-code">{{ formatCode(orderQuery.result.card.code) }}</code>
          </span>
          <span class="oq-item">
            剩余时间
            <b :style="{ color: (orderQuery.result.card.remainingMs ?? 0) <= 0 ? '#f56c6c' : '#67c23a' }">
              {{ formatRemaining(orderQuery.result.card.remainingMs) }}
            </b>
          </span>
          <el-button
            v-if="orderQuery.result.card.status === 'activated'"
            type="warning"
            size="small"
            @click="handleReplace(orderQuery.result.card, true)"
          >
            换卡
          </el-button>
        </template>
        <span v-else-if="orderQuery.msg" class="oq-msg">{{ orderQuery.msg }}</span>
      </div>
      <div class="table-wrapper">
        <el-table
          v-loading="loading"
          :data="tableData"
          :fit="true"
          row-key="id"
          :tree-props="{ children: 'children' }"
          stripe
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="45" />
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column label="卡密" min-width="200">
            <template #default="{ row }">
              <code class="code-text">{{ formatCode(row.code) }}</code>
            </template>
          </el-table-column>
          <el-table-column label="类型" min-width="80">
            <template #default="{ row }">
              {{ cardTypeMap[row.type] || row.type }}
            </template>
          </el-table-column>
          <el-table-column label="天数" min-width="100">
            <template #default="{ row }">
              {{ formatDays(row.days) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" min-width="90">
            <template #default="{ row }">
              <el-tag :type="tagMap[effectiveStatus(row)]" size="small">
                {{ cardStatusMap[effectiveStatus(row)] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="机器码" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <el-tooltip :content="row.machineCode || ''" placement="top" :disabled="!row.machineCode">
                <span>{{ maskMachineCode(row.machineCode) }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="IP地址" min-width="130" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.realIp" :style="{ color: row.reportedIp && row.reportedIp !== row.realIp ? '#f56c6c' : '' }">
                <el-tooltip :content="row.realIp" placement="top">
                  <span>{{ maskIp(row.realIp) }}</span>
                </el-tooltip>
                <el-tooltip v-if="row.reportedIp && row.reportedIp !== row.realIp" content="客户端上报 IP 与服务端不一致" placement="top">
                  <span style="cursor:help;font-size:12px"> ⚠</span>
                </el-tooltip>
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="激活时间" min-width="160">
            <template #default="{ row }">
              {{ row.activatedAt ? dayjs(row.activatedAt).format("YYYY-MM-DD HH:mm") : "-" }}
            </template>
          </el-table-column>
          <el-table-column label="到期时间" min-width="160">
            <template #default="{ row }">
              {{ row.expiresAt ? dayjs(row.expiresAt).format("YYYY-MM-DD HH:mm") : "-" }}
            </template>
          </el-table-column>
          <el-table-column label="已验证" min-width="90" align="center">
            <template #default="{ row }">
              <span v-if="row.verifiedCount > 0" :style="{ color: row.verifiedCount > 5 ? '#f56c6c' : row.verifiedCount > 2 ? '#e6a23c' : '#67c23a' }">
                {{ row.verifiedCount }}次
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="最后验证" min-width="160">
            <template #default="{ row }">
              {{ row.lastVerifiedAt ? dayjs(row.lastVerifiedAt).format("YYYY-MM-DD HH:mm:ss") : "-" }}
            </template>
          </el-table-column>
          <el-table-column prop="batchNote" label="批次备注" min-width="90" show-overflow-tooltip />
          <el-table-column label="换卡来源" min-width="110">
            <template #default="{ row }">
              <span v-if="row.replaceFromId" style="color: #e6a23c; font-size: 12px">
                由卡密 #{{ row.replaceFromId }} 换卡{{ row.replaceDepth > 1 ? `（第${row.replaceDepth}次）` : "" }}
              </span>
              <span v-else-if="row.replaceDepth > 0" style="color: #909399; font-size: 12px">换卡 ×{{ row.replaceDepth }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="240" fixed="right" align="center">
            <template #default="{ row }">
              <el-button v-if="row.status === 'activated'" type="warning" size="small" text @click="handleReplace(row)">
                换卡
              </el-button>
              <el-button v-if="row.status !== 'disabled'" type="danger" size="small" text @click="handleDisable(row)">
                禁用
              </el-button>
              <el-button type="danger" size="small" text @click="handleRemove(row)">
                删除
              </el-button>
              <el-button type="primary" size="small" text @click="handleExport(row)">
                复制
              </el-button>
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
      <div class="table-hint">
        外层列表按卡密分页；换卡关系以树形展示：原卡为父节点，换卡生成的新卡为子节点（▲ 展开查看），子卡不占分页。
      </div>
    </el-card>

    <!-- 生成卡密弹窗 -->
    <el-dialog v-model="dialogVisible" title="生成卡密" width="480px" destroy-on-close>
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="80px">
        <el-form-item label="类型" prop="type">
          <el-select v-model="formData.type" style="width: 100%" @change="onTypeChange">
            <el-option
              v-for="p in plans.length ? plans : Object.keys(cardTypeMap).map(t => ({ type: t, name: cardTypeMap[t], days: dayPresets[t] || 1, enabled: true }))"
              :key="p.type"
              :label="`${p.name}（${formatDaysHint(p.days)}）`"
              :value="p.type"
              :disabled="p.enabled === false"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="有效期" prop="days">
          <el-input-number v-model="formData.days" :min="0.0001" :max="36500" :precision="6" :step="0.01" style="width: 100%" />
          <div class="form-hint" style="margin-top:4px;font-size:12px;color:#909399">
            {{ formatDaysHint(formData.days) }}
          </div>
        </el-form-item>
        <el-form-item label="数量" prop="count">
          <el-input-number v-model="formData.count" :min="1" :max="1000" style="width: 100%" />
        </el-form-item>
        <el-form-item label="批次备注" prop="batchNote">
          <el-input v-model="formData.batchNote" placeholder="例如：2024年8月批次" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button type="primary" :loading="formLoading" @click="handleGenerate">
          确认生成
        </el-button>
      </template>
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
.search-wrapper {
  margin-bottom: 16px;
  :deep(.el-card__body) {
    padding-bottom: 0;
  }
}
.toolbar-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.toolbar-spacer {
  flex: 1;
}

.order-query {
  display: flex;
  align-items: center;
  gap: 8px;
}

.order-query-result {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding: 10px 14px;
  background: rgba(230, 162, 60, 0.08);
  border: 1px solid rgba(230, 162, 60, 0.3);
  border-radius: 10px;
  font-size: 13px;
}

.oq-item {
  color: #606266;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.oq-code {
  font-family: "Consolas", monospace;
  font-weight: 700;
  color: #b45309;
}

.oq-msg {
  color: #f56c6c;
  font-size: 13px;
}

.table-hint {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
}
.table-wrapper {
  .code-text {
    font-family: "Consolas", monospace;
    font-size: 13px;
    color: var(--el-color-primary);
  }
}
.pager-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
