<script lang="ts" setup>
import type { GameAssetRow } from "@@/apis/game-assets"
import {
  getGameAssetApi,
  listGameAssetsApi,
  resetGameAssetApi,
  updateGameAssetApi
} from "@@/apis/game-assets"

defineOptions({ name: "GameAssets" })

const loading = ref(false)
const rows = ref<GameAssetRow[]>([])

/** 编辑弹窗 */
const edit = reactive({
  visible: false,
  key: "",
  label: "",
  source: "" as "" | "db" | "file",
  value: "",
  loading: false,
  saving: false
})

/** 当前编辑内容的 JSON 校验结果 */
const jsonOk = computed(() => {
  if (!edit.value.trim()) return false
  try {
    const v = JSON.parse(edit.value)
    return v !== null && typeof v === "object"
  } catch {
    return false
  }
})

const sourceMeta: Record<string, { text: string, type: "success" | "warning" | "danger" }> = {
  db: { text: "库(data)", type: "success" },
  file: { text: "文件种子", type: "warning" },
  none: { text: "无", type: "danger" }
}

function fmtBytes(n: number | null) {
  if (n == null) return "—"
  if (n < 1024) return `${n} B`
  return `${(n / 1024).toFixed(1)} KB`
}

function fmtTime(t: string | null) {
  if (!t) return "—"
  return new Date(t).toLocaleString()
}

async function loadList() {
  loading.value = true
  try {
    const { data } = await listGameAssetsApi()
    rows.value = data || []
  } finally {
    loading.value = false
  }
}

async function openEdit(row: any) {
  edit.visible = true
  edit.key = row.key
  edit.label = row.label
  edit.value = ""
  edit.loading = true
  try {
    const { data } = await getGameAssetApi(row.key)
    edit.source = data.source
    edit.value = data.value
  } finally {
    edit.loading = false
  }
}

function formatJson() {
  try {
    edit.value = JSON.stringify(JSON.parse(edit.value), null, 2)
    ElMessage.success("已格式化")
  } catch {
    ElMessage.error("不是合法 JSON，无法格式化")
  }
}

async function save() {
  if (!jsonOk.value) {
    ElMessage.error("内容必须是合法的 JSON 对象或数组")
    return
  }
  edit.saving = true
  try {
    await updateGameAssetApi(edit.key, edit.value)
    ElMessage.success("已保存到数据库（全部用户下次启动即生效）")
    edit.visible = false
    await loadList()
  } finally {
    edit.saving = false
  }
}

async function doReset(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定把「${row.label}」重置为部署机上的文件种子？当前数据库里的版本会被覆盖。`,
      "重置确认",
      { type: "warning" }
    )
  } catch {
    return
  }
  await resetGameAssetApi(row.key)
  ElMessage.success("已重置为文件种子")
  await loadList()
}

onMounted(() => loadList())
</script>

<template>
  <div class="game-assets-page">
    <el-card shadow="never">
      <template #header>
        <div class="hd">
          <span>关键数据表（后端下发源）</span>
          <el-button :loading="loading" @click="loadList">
            刷新
          </el-button>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="这些表由启动器启动时从后端拉取（凭卡密鉴权）。改这里 = 全部用户下次启动即生效，无需重发客户端。"
        class="tip"
      />

      <el-table v-loading="loading" :data="rows" border stripe>
        <el-table-column label="表" min-width="220">
          <template #default="{ row }">
            <div class="cell-name">
              {{ row.label }}
            </div>
            <div class="cell-key">
              {{ row.key }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="sourceMeta[row.source]?.type || 'info'" size="small">
              {{ sourceMeta[row.source]?.text || row.source }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="100" align="right">
          <template #default="{ row }">
            {{ fmtBytes(row.bytes) }}
          </template>
        </el-table-column>
        <el-table-column label="最后更新" min-width="170">
          <template #default="{ row }">
            {{ fmtTime(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="更新者" min-width="140">
          <template #default="{ row }">
            {{ row.updatedBy || "—" }}
          </template>
        </el-table-column>
        <el-table-column label="文件种子" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.fileExists ? 'info' : 'danger'" size="small" effect="plain">
              {{ row.fileExists ? "有" : "无" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button
              link
              type="warning"
              :disabled="!row.fileExists"
              @click="doReset(row)"
            >
              重置种子
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="edit.visible"
      :title="`编辑：${edit.label}`"
      width="860px"
      top="6vh"
      destroy-on-close
    >
      <div v-loading="edit.loading" class="edit-body">
        <div class="edit-bar">
          <el-tag size="small" effect="plain">
            key：{{ edit.key }}
          </el-tag>
          <el-tag v-if="edit.source" size="small" :type="sourceMeta[edit.source]?.type">
            当前来源：{{ sourceMeta[edit.source]?.text }}
          </el-tag>
          <el-tag size="small" :type="jsonOk ? 'success' : 'danger'">
            {{ jsonOk ? "JSON 合法" : "JSON 非法" }}
          </el-tag>
          <div class="spacer" />
          <el-button size="small" @click="formatJson">
            格式化
          </el-button>
        </div>
        <el-input
          v-model="edit.value"
          type="textarea"
          :rows="22"
          spellcheck="false"
          placeholder="JSON 内容"
          class="editor"
        />
        <div class="hint">
          ⚠️ 保存前请确认结构正确（填错会让全部用户下次启动拿到坏表）。不确定时可用「重置种子」恢复。
        </div>
      </div>
      <template #footer>
        <el-button @click="edit.visible = false">
          取消
        </el-button>
        <el-button type="primary" :loading="edit.saving" :disabled="!jsonOk" @click="save">
          保存到数据库
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.game-assets-page {
  padding: 16px;
}
.hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tip {
  margin-bottom: 12px;
}
.cell-name {
  font-weight: 600;
}
.cell-key {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.edit-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.spacer {
  flex: 1;
}
.editor :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
}
.hint {
  margin-top: 8px;
  color: var(--el-color-warning);
  font-size: 12px;
}
</style>
