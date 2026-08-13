<script lang="ts" setup>
import type { CardData, GenerateCardsRequestData } from "@@/apis/cards/type"
import type { PlanItem } from "@@/apis/plans"
import type { FormRules } from "element-plus"
import { batchRemoveCardsApi, disableCardApi, generateCardsApi, getCardsApi, getCardsStatsApi, removeCardApi } from "@@/apis/cards"
import { getPlansApi } from "@@/apis/plans"
import { usePagination } from "@@/composables/usePagination"
import dayjs from "dayjs"

defineOptions({ name: "CardsManage" })

const loading = ref(false)
const tableData = ref<CardData[]>([])
const stats = ref<any>({})
const dialogVisible = ref(false)

// 分页
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
const cardStatusMap: Record<string, string> = { unused: "未使用", sold: "已售出", activated: "已激活", disabled: "已禁用" }
const tagMap: Record<string, "info" | "warning" | "success" | "danger"> = { unused: "info", sold: "warning", activated: "success", disabled: "danger" }

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

// 获取表格数据
async function getTableData() {
  loading.value = true
  try {
    const { data } = await getCardsApi({
      currentPage: paginationData.currentPage!,
      size: paginationData.pageSize!,
      status: searchData.status || undefined,
      code: searchData.code || undefined,
      batchNote: searchData.batchNote || undefined
    })
    tableData.value = data.items
    paginationData.total = data.total
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

// 禁用
async function handleDisable(row: any) {
  const card = row as CardData
  await ElMessageBox.confirm(`确定禁用卡密 ${card.code}？`, "提示", { type: "warning" })
  try {
    await disableCardApi(card.id)
    ElMessage.success("已禁用")
    getTableData()
  } catch { /* */ }
}

// 删除单张
async function handleRemove(row: any) {
  const card = row as CardData
  try {
    await ElMessageBox.confirm(
      `确定删除卡密 ${card.code}？\n（仅未使用/已禁用卡密可删除；已售出/已激活会破坏用户，禁止删除）`,
      "删除卡密",
      { type: "warning" }
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
      </div>
      <div class="table-wrapper">
        <el-table v-loading="loading" :data="tableData" stripe @selection-change="onSelectionChange">
          <el-table-column type="selection" width="45" />
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column label="卡密" min-width="180">
            <template #default="{ row }">
              <code class="code-text">{{ formatCode(row.code) }}</code>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="80">
            <template #default="{ row }">
              {{ cardTypeMap[row.type] || row.type }}
            </template>
          </el-table-column>
          <el-table-column prop="days" label="天数" width="70" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="tagMap[row.status]" size="small">
                {{ cardStatusMap[row.status] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="机器码" width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <el-tooltip :content="row.machineCode || ''" placement="top" :disabled="!row.machineCode">
                <span>{{ maskMachineCode(row.machineCode) }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="IP地址" width="130" show-overflow-tooltip>
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
          <el-table-column label="激活时间" width="160">
            <template #default="{ row }">
              {{ row.activatedAt ? dayjs(row.activatedAt).format("YYYY-MM-DD HH:mm") : "-" }}
            </template>
          </el-table-column>
          <el-table-column label="到期时间" width="160">
            <template #default="{ row }">
              {{ row.expiresAt ? dayjs(row.expiresAt).format("YYYY-MM-DD HH:mm") : "-" }}
            </template>
          </el-table-column>
          <el-table-column label="已验证" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.verifiedCount > 0" :style="{ color: row.verifiedCount > 5 ? '#f56c6c' : row.verifiedCount > 2 ? '#e6a23c' : '#67c23a' }">
                {{ row.verifiedCount }}次
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="最后验证" width="160">
            <template #default="{ row }">
              {{ row.lastVerifiedAt ? dayjs(row.lastVerifiedAt).format("YYYY-MM-DD HH:mm:ss") : "-" }}
            </template>
          </el-table-column>
          <el-table-column prop="batchNote" label="批次备注" width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status !== 'disabled' && row.status !== 'activated'" type="danger" size="small" text @click="handleDisable(row)">
                禁用
              </el-button>
              <el-button v-if="row.status === 'unused' || row.status === 'disabled'" type="danger" size="small" text @click="handleRemove(row)">
                删除
              </el-button>
              <el-button v-if="row.status !== 'activated'" type="primary" size="small" text @click="handleExport(row)">
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
  margin-bottom: 12px;
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
