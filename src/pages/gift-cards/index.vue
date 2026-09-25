<script lang="ts" setup>
import type { GenerateGiftCardsRequestData, GiftCardData } from "@@/apis/cards/type"
import type { PlanItem } from "@@/apis/plans"
import type { FormRules } from "element-plus"
import { disableCardApi, enableCardApi, generateGiftCardsApi, getCardsStatsApi, getGiftCardsApi, removeCardApi } from "@@/apis/cards"
import { getPlansApi } from "@@/apis/plans"
import { usePagination } from "@@/composables/usePagination"
import dayjs from "dayjs"

defineOptions({ name: "GiftCardsManage" })

const loading = ref(false)
const tableData = ref<GiftCardData[]>([])
const stats = ref<any>({})
const dialogVisible = ref(false)

const { paginationData, resetCurrentPage, watchPagination } = usePagination({ callback: getTableData })

const searchData = reactive({ status: "", type: "", code: "", giftTo: "" })

// 套餐列表（类型下拉动态来源）
const plans = ref<PlanItem[]>([])
const cardTypeMap = ref<Record<string, string>>({ minute: "分钟卡", hour: "小时卡", day: "日卡", month: "月卡", quarter: "季卡", year: "年卡", lifetime: "永久卡" })
async function loadPlans() {
  try {
    const { data } = await getPlansApi()
    const list = data || []
    plans.value = list
    const map: Record<string, string> = {}
    for (const p of list) map[p.type] = p.name
    if (Object.keys(map).length > 0) cardTypeMap.value = { ...cardTypeMap.value, ...map }
    const first = list.find((p: PlanItem) => p.enabled)
    if (first) DEFAULT_FORM.type = first.type
  } catch { /* 保留静态映射兜底 */ }
}

/** 赠卡状态：gifted=未激活（还没被受赠人激活）/ activated=已激活 / disabled=已禁用 */
const giftStatusMap: Record<string, string> = { gifted: "未激活", activated: "已激活", disabled: "已禁用" }
const tagMap: Record<string, "info" | "warning" | "success" | "danger"> = { gifted: "warning", activated: "success", disabled: "danger" }

/** 卡密展示：ABCDEFGHJKMNQPRS → ABCD-EFGH-JKMN-QPRS */
function formatCode(raw: string): string {
  if (!raw) return ""
  const clean = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase()
  if (clean.length === 16) return clean.match(/.{1,4}/g)?.join("-") || raw
  return raw
}

/** 脱敏机器码：前4位****后4位 */
function maskMachineCode(code: string | null): string {
  if (!code) return "-"
  if (code.length <= 8) return code
  return `${code.slice(0, 4)}****${code.slice(-4)}`
}

/** 天数格式化：天卡"30 天"，小时卡"1 小时"，分钟卡"4 分钟"，永久"永久" */
function formatDays(days: number): string {
  if (!days || days <= 0) return "-"
  if (days >= 36500) return "永久"
  if (days >= 1) return `${Math.round(days * 10) / 10} 天`
  const hours = days * 24
  if (hours >= 1) return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`
  return `${Math.round(days * 1440)} 分钟`
}

/** 剩余时间 */
function formatRemaining(expiresAt: string | null, status: string): string {
  if (status !== "activated" || !expiresAt) return "-"
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return "已过期"
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins} 分钟`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时`
  return `${Math.floor(hours / 24)} 天`
}

async function getTableData() {
  loading.value = true
  try {
    const { data } = await getGiftCardsApi({
      currentPage: paginationData.currentPage!,
      size: paginationData.pageSize!,
      status: searchData.status || undefined,
      type: searchData.type || undefined,
      code: searchData.code || undefined,
      giftTo: searchData.giftTo || undefined
    })
    tableData.value = data.items
    paginationData.total = data.total
  } catch { /* 错误已由拦截器处理 */ } finally {
    loading.value = false
  }
}

async function getStats() {
  try {
    const { data } = await getCardsStatsApi()
    stats.value = data
  } catch { /* */ }
}

function handleSearch() {
  resetCurrentPage()
}
function resetSearch() {
  searchData.status = ""
  searchData.type = ""
  searchData.code = ""
  searchData.giftTo = ""
  handleSearch()
}

// ===== 生成赠送卡 =====
const DEFAULT_FORM: GenerateGiftCardsRequestData = { type: "month", count: 1, giftReason: "", giftTo: "" }
const formData = ref<GenerateGiftCardsRequestData>({ ...DEFAULT_FORM })
const formRef = useTemplateRef("formRef")
const formLoading = ref(false)
const formRules: FormRules = {
  type: [{ required: true, message: "请选择类型", trigger: "change" }],
  count: [
    { required: true, message: "请输入数量", trigger: "blur" },
    { type: "number", min: 1, max: 100, message: "1~100", trigger: "blur" }
  ],
  giftReason: [{ required: true, message: "请填写赠送事由（便于日后追溯）", trigger: "blur" }]
}

/** 本次生成的卡密（生成后直接展示，方便复制发给受赠人） */
const lastGift = ref<string[]>([])

function openDialog() {
  formData.value = { ...DEFAULT_FORM }
  dialogVisible.value = true
}

async function handleGenerate() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  formLoading.value = true
  try {
    const res: any = await generateGiftCardsApi(formData.value)
    const codes: string[] = (res?.data || []).map((c: any) => c.code)
    lastGift.value = codes
    dialogVisible.value = false
    ElMessage.success(`已生成 ${codes.length} 张赠送卡`)
    if (codes.length > 0) {
      try {
        await navigator.clipboard.writeText(codes.join("\n"))
        ElMessage.success("卡密已复制到剪贴板")
      } catch { /* 剪贴板不可用时用下方列表手动复制 */ }
    }
    getTableData()
    getStats()
  } catch { /* */ } finally {
    formLoading.value = false
  }
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    ElMessage.success("已复制到剪贴板")
  } catch {
    ElMessage.warning("复制失败，请手动选择复制")
  }
}

async function copyAllLast() {
  if (!lastGift.value.length) return
  await copyCode(lastGift.value.join("\n"))
}

// ===== 行操作 =====
async function handleDisable(row: any) {
  await ElMessageBox.confirm(`确定禁用赠卡 ${formatCode(row.code)}？禁用后受赠人将无法激活。`, "提示", { type: "warning" })
  try {
    await disableCardApi(row.id)
    ElMessage.success("已禁用")
    getTableData()
    getStats()
  } catch { /* */ }
}

async function handleEnable(row: any) {
  await ElMessageBox.confirm(
    `确定启用赠卡 ${formatCode(row.code)}？\n（未激活的恢复为「未激活」，曾激活过的恢复为「已激活」并保留原到期时间）`,
    "提示",
    { type: "info" }
  )
  try {
    await enableCardApi(row.id)
    ElMessage.success("已启用")
    getTableData()
    getStats()
  } catch { /* */ }
}

async function handleRemove(row: any) {
  const used = row.status === "activated"
  try {
    await ElMessageBox.confirm(
      used
        ? `⚠️ 该赠卡已被受赠人激活！删除后对方将无法继续验证。\n\n卡密：${formatCode(row.code)}\n受赠人：${row.giftTo || "-"}\n\n确定仍要删除吗？`
        : `确定删除赠卡 ${formatCode(row.code)}？`,
      "删除赠卡",
      { type: "warning", confirmButtonText: "确定删除", cancelButtonText: "取消" }
    )
  } catch {
    return
  }
  try {
    await removeCardApi(row.id)
    ElMessage.success("已删除")
    getTableData()
    getStats()
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败")
  }
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
          { label: '累计赠送', key: 'giftTotal', color: '#e6a23c' },
          { label: '未激活', key: 'giftPending', color: '#409eff' },
          { label: '已激活', key: 'giftUsed', color: '#67c23a' },
        ]" :key="item.key" :span="8"
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

    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="tip-alert"
      title="赠送卡与销售库存完全隔离：赠送卡不会被买家买到，也永远不计入「可售库存」。"
      description="赠卡在受赠人首次激活前不计算时长（激活那一刻才开始计时），所以可以提前生成、慢慢发。"
    />

    <!-- 本次生成结果（方便复制） -->
    <el-card v-if="lastGift.length" shadow="never" class="result-card">
      <div class="result-head">
        <span>本次生成 {{ lastGift.length }} 张赠送卡</span>
        <div>
          <el-button type="primary" size="small" @click="copyAllLast">
            复制全部
          </el-button>
          <el-button size="small" text @click="lastGift = []">
            关闭
          </el-button>
        </div>
      </div>
      <div class="result-codes">
        <code v-for="c in lastGift" :key="c" class="code-chip" @click="copyCode(c)">{{ formatCode(c) }}</code>
      </div>
    </el-card>

    <!-- 搜索 -->
    <el-card shadow="never" class="search-wrapper">
      <el-form :inline="true" :model="searchData">
        <el-form-item label="状态">
          <el-select v-model="searchData.status" clearable placeholder="全部" style="width: 130px">
            <el-option v-for="(label, value) in giftStatusMap" :key="value" :label="label" :value="value" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="searchData.type" clearable placeholder="全部" style="width: 140px">
            <el-option
              v-for="p in (plans.length ? plans : Object.keys(cardTypeMap).map(t => ({ type: t, name: cardTypeMap[t] })))"
              :key="p.type"
              :label="p.name"
              :value="p.type"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="受赠人">
          <el-input v-model="searchData.giftTo" placeholder="QQ / 昵称" clearable style="width: 150px" />
        </el-form-item>
        <el-form-item label="卡密">
          <el-input v-model="searchData.code" placeholder="搜索卡密" clearable style="width: 170px" />
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
          生成赠送卡
        </el-button>
      </div>
      <el-table v-loading="loading" :data="tableData" stripe>
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
        <el-table-column label="时长" min-width="90">
          <template #default="{ row }">
            {{ formatDays(row.days) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="90">
          <template #default="{ row }">
            <el-tag :type="tagMap[row.status] || 'info'" size="small">
              {{ giftStatusMap[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="受赠人" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.giftTo">{{ row.giftTo }}</span>
            <span v-else class="muted">未填写</span>
          </template>
        </el-table-column>
        <el-table-column label="赠送事由" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.giftReason || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="操作人" min-width="100">
          <template #default="{ row }">
            {{ row.giftedBy || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="赠送时间" min-width="150">
          <template #default="{ row }">
            {{ row.giftedAt ? dayjs(row.giftedAt).format("YYYY-MM-DD HH:mm") : "-" }}
          </template>
        </el-table-column>
        <el-table-column label="激活时间" min-width="150">
          <template #default="{ row }">
            {{ row.activatedAt ? dayjs(row.activatedAt).format("YYYY-MM-DD HH:mm") : "-" }}
          </template>
        </el-table-column>
        <el-table-column label="到期 / 剩余" min-width="150">
          <template #default="{ row }">
            <div v-if="row.status === 'activated' && row.expiresAt">
              <div>{{ dayjs(row.expiresAt).format("YYYY-MM-DD HH:mm") }}</div>
              <div class="muted">
                剩 {{ formatRemaining(row.expiresAt, row.status) }}
              </div>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="机器码" min-width="140">
          <template #default="{ row }">
            {{ maskMachineCode(row.machineCode) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" size="small" text @click="copyCode(row.code)">
              复制
            </el-button>
            <el-button v-if="row.status !== 'disabled'" type="danger" size="small" text @click="handleDisable(row)">
              禁用
            </el-button>
            <el-button v-else type="success" size="small" text @click="handleEnable(row)">
              启用
            </el-button>
            <el-button type="danger" size="small" text @click="handleRemove(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
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
        赠送卡来源为 gift，永不参与订单取卡；受赠人在启动器输入卡密即可激活（首次激活才开始计算时长）。
      </div>
    </el-card>

    <!-- 生成赠送卡弹窗 -->
    <el-dialog v-model="dialogVisible" title="生成赠送卡" width="480px" destroy-on-close>
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="88px">
        <el-form-item label="类型" prop="type">
          <el-select v-model="formData.type" style="width: 100%">
            <el-option
              v-for="p in plans.length ? plans : Object.keys(cardTypeMap).map(t => ({ type: t, name: cardTypeMap[t], days: 1, enabled: true }))"
              :key="p.type"
              :label="p.name"
              :value="p.type"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" prop="count">
          <el-input-number v-model="formData.count" :min="1" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="赠送事由" prop="giftReason">
          <el-input v-model="formData.giftReason" placeholder="例如：BUG 反馈奖励 / 优化建议奖励" maxlength="255" show-word-limit />
        </el-form-item>
        <el-form-item label="受赠人" prop="giftTo">
          <el-input v-model="formData.giftTo" placeholder="QQ 号 / 昵称（可留空，便于日后追溯建议填写）" maxlength="128" />
        </el-form-item>
        <el-alert
          type="warning"
          :closable="false"
          title="赠送卡与销售库存完全隔离，买家不可能买到它。"
          class="form-alert"
        />
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
.tip-alert {
  margin-bottom: 16px;
}
.result-card {
  margin-bottom: 16px;
}
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
}
.result-codes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.code-chip {
  font-family: "Consolas", monospace;
  font-size: 13px;
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  &:hover {
    background: var(--el-fill-color);
  }
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
.code-text {
  font-family: "Consolas", monospace;
  font-size: 13px;
  color: var(--el-color-primary);
}
.muted {
  color: #909399;
  font-size: 12px;
}
.pager-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.table-hint {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
}
.form-alert {
  margin-top: 4px;
}
</style>
