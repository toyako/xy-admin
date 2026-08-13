<script lang="ts" setup>
import type { PlanItem } from "@@/apis/plans"
import { createPlanApi, deletePlanApi, getPlansApi, updatePlanApi } from "@@/apis/plans"
import { onMounted, reactive, ref } from "vue"

defineOptions({ name: "PlanManage" })

const loading = ref(false)
const list = ref<PlanItem[]>([])
const dialogVisible = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)

// 时长预设（用户选类型自动带时长）
const durationPresets: Record<string, { label: string, days: number }> = {
  minute: { label: "分钟卡", days: 4 / 1440 },
  hour: { label: "小时卡", days: 1 / 24 },
  day: { label: "日卡", days: 1 },
  month: { label: "月卡", days: 30 },
  quarter: { label: "季卡", days: 90 },
  year: { label: "年卡", days: 365 },
  lifetime: { label: "永久卡", days: 36500 }
}

const form = reactive({
  type: "",
  name: "",
  days: 30,
  price: 29.9,
  enabled: true
})

async function load() {
  loading.value = true
  try {
    const { data } = await getPlansApi()
    list.value = data || []
  } catch { /* */ } finally {
    loading.value = false
  }
}

function openCreate() {
  editId.value = null
  Object.assign(form, { type: "", name: "", days: 30, price: 29.9, enabled: true })
  dialogVisible.value = true
}

function openEdit(row: any) {
  editId.value = row.id
  Object.assign(form, {
    type: row.type,
    name: row.name,
    days: row.days,
    price: (row.price / 100).toFixed(2),
    enabled: row.enabled
  })
  dialogVisible.value = true
}

/** 选择类型时自动填充名称/时长（仅新增场景） */
function onTypeChange() {
  const preset = durationPresets[form.type]
  if (preset) {
    form.name = preset.label
    form.days = preset.days
  }
}

async function handleSave() {
  if (!form.type.trim() || !form.name.trim()) {
    ElMessage.warning("请填写类型标识和套餐名称")
    return
  }
  const days = Number(form.days)
  const price = Number(form.price)
  if (isNaN(days) || days <= 0) {
    ElMessage.warning("时长必须大于 0（天）")
    return
  }
  if (isNaN(price) || price <= 0) {
    ElMessage.warning("价格必须大于 0")
    return
  }
  saving.value = true
  try {
    const payload = {
      type: form.type.trim().toLowerCase(),
      name: form.name.trim(),
      days,
      price: Math.round(price * 100),
      enabled: form.enabled
    }
    if (editId.value) {
      await updatePlanApi(editId.value, payload)
      ElMessage.success("已保存")
    } else {
      await createPlanApi(payload)
      ElMessage.success("已添加")
    }
    dialogVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败")
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定删除套餐「${row.name}」？\n（该套餐下已有卡密时无法删除，可改为隐藏）`,
      "删除套餐",
      { type: "warning" }
    )
  } catch {
    return
  }
  try {
    await deletePlanApi(row.id)
    ElMessage.success("已删除")
    load()
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败")
  }
}

/** 展示/隐藏 快捷开关 */
async function toggleShow(row: any, v: boolean | string | number) {
  const enabled = v === true || v === "true" || v === 1
  try {
    await updatePlanApi(row.id, { enabled })
    ElMessage.success(enabled ? "已展示" : "已隐藏")
    load()
  } catch (e: any) {
    ElMessage.error(e?.message || "操作失败")
  }
}

/** 时长展示：分钟/小时/天/月/年/永久 */
function formatDays(days: number): string {
  if (days >= 36500) return "永久"
  if (days >= 365) return `${Math.round(days / 365)} 年`
  if (days >= 30) return `${Math.round(days / 30)} 个月`
  if (days >= 1) return `${days} 天`
  if (days >= 1 / 24) return `${Math.round(days * 24)} 小时`
  return `${Math.round(days * 1440)} 分钟`
}

function formatMoney(cents: number) {
  return (cents / 100).toFixed(2)
}

onMounted(load)
</script>

<template>
  <div class="app-container">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">套餐管理</span>
          <el-button type="primary" @click="openCreate">
            + 新增套餐
          </el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="name" label="套餐名称" width="110" />
        <el-table-column prop="type" label="类型标识" width="110">
          <template #default="{ row }">
            <code>{{ row.type }}</code>
          </template>
        </el-table-column>
        <el-table-column label="价格" width="90">
          <template #default="{ row }">
            ¥{{ formatMoney(row.price) }}
          </template>
        </el-table-column>
        <el-table-column label="时长" width="100">
          <template #default="{ row }">
            {{ formatDays(row.days) }}
          </template>
        </el-table-column>
        <el-table-column label="库存" width="80">
          <template #default="{ row }">
            {{ row.stats?.total || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="可用" width="80">
          <template #default="{ row }">
            <span v-if="(row.stats?.available || 0) === 0 && row.enabled" style="color: #f56c6c; font-weight: 600">售罄</span>
            <span v-else>{{ row.stats?.available || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="已售出" width="80" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tooltip content="有订单的卡密（真交易）" placement="top">
              <span>{{ row.stats?.sold || 0 }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="已使用" width="80" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tooltip content="启动器激活过的卡密（含自测和真实用户）" placement="top">
              <span>{{ row.stats?.activated || 0 }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="已过期" width="80">
          <template #default="{ row }">
            {{ row.stats?.expired || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="已禁用" width="80">
          <template #default="{ row }">
            {{ row.stats?.disabled || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="展示" width="110">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              inline-prompt
              active-text="展示"
              inactive-text="隐藏"
              @change="(v) => toggleShow(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="form-hint" style="margin-top: 12px">
        「展示」= 用户端可见（库存为 0 时用户端显示"售罄"并禁止购买）；「隐藏」= 用户端完全不展示。隐藏时不能下单、不能生成卡密（历史卡密不受影响）。有卡密的套餐不能删除。
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑套餐' : '新增套餐'" width="520px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="类型标识" v-if="!editId">
          <el-input v-model="form.type" placeholder="如 minute / month / vip1（小写字母开头）" />
          <div class="form-hint">
            创建后不可修改；与订单/卡密/启动器共用
          </div>
        </el-form-item>
        <el-form-item label="套餐名称">
          <el-input v-model="form.name" placeholder="如 月卡 / VIP会员" />
        </el-form-item>
        <el-form-item label="时长(天)">
          <div style="display: flex; gap: 8px; width: 100%">
            <el-input v-model="form.days" type="number" placeholder="30" style="flex: 1" />
            <el-select v-if="!editId" :model-value="form.type" placeholder="快捷选时长" style="width: 130px" @change="(v: string) => { form.type = v; onTypeChange(); }">
              <el-option v-for="(p, t) in durationPresets" :key="t" :label="p.label" :value="t" />
            </el-select>
          </div>
          <div class="form-hint">
            分钟卡填 4/1440（约0.0028）、小时卡 1/24、月卡 30、永久卡 36500
          </div>
        </el-form-item>
        <el-form-item label="价格(元)">
          <el-input v-model="form.price" type="number" placeholder="29.9" style="width: 200px" />
        </el-form-item>
        <el-form-item label="展示">
          <el-switch v-model="form.enabled" />
          <div class="form-hint" style="margin-top: 4px">
            开=用户端可见（库存 0 时显示"售罄"）；关=用户端不展示
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.app-container {
  padding: 16px;
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
.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}
</style>
