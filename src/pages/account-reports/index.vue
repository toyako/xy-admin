<script lang="ts" setup>
import type { AccountBanData, DeviceNode, DeviceTree } from "@@/apis/account-reports/type"
import {
  banPlayerApi,
  deviceTreeApi,
  getAccountBansApi,
  listDevicesApi,
  unbanPlayerApi
} from "@@/apis/account-reports"
import dayjs from "dayjs"

defineOptions({ name: "AccountReports" })

/** ===== 树行类型 ===== */
interface TreeRow {
  _type: "device" | "account" | "server" | "role"
  key: string
  hasChildren?: boolean
  children?: TreeRow[]
  deviceId?: string
  gameAccount?: string
  serverLabel?: string
  cardCode?: string | null
  roleName?: string
  roleId?: string
  lvl?: number
  banned: boolean
  banReason: string | null
  online?: boolean
  lastSeenAt?: string
  firstSeenAt?: string
  accountCount?: number
  serverCount?: number
  roleCount?: number
}

const loading = ref(false)
const topRows = ref<TreeRow[]>([])
const total = ref(0)
const keyword = ref("")

const statOnline = computed(() => topRows.value.filter(r => r.online && !r.banned).length)
const statBanned = computed(() => topRows.value.filter(r => r.banned).length)
const statDevice = computed(() => topRows.value.length)

async function fetchData() {
  loading.value = true
  try {
    const { data } = await listDevicesApi(keyword.value.trim() || undefined)
    topRows.value = data.items.map(d => toDeviceRow(d))
    total.value = data.total
  } catch { /* */ } finally {
    loading.value = false
  }
}

function toDeviceRow(d: DeviceNode): TreeRow {
  return {
    _type: "device",
    key: `device-${d.deviceId}`,
    deviceId: d.deviceId,
    accountCount: d.accountCount,
    serverCount: d.serverCount,
    roleCount: d.roleCount,
    firstSeenAt: d.firstSeenAt,
    lastSeenAt: d.lastSeenAt,
    online: d.online,
    banned: d.banned,
    banReason: d.banReason,
    hasChildren: d.accountCount > 0
  }
}

/** 设备懒加载：拉整棵 账号→区服→角色 子树 */
async function loadTree(row: any, _treeNode: any, resolve: (data: TreeRow[]) => void) {
  if (row._type !== "device" || !row.deviceId) {
    resolve([])
    return
  }
  try {
    const { data } = await deviceTreeApi(row.deviceId)
    resolve(buildChildren(data))
  } catch (e: any) {
    ElMessage.error(e?.message || "加载设备详情失败")
    resolve([])
  }
}

function buildChildren(tree: DeviceTree): TreeRow[] {
  return tree.accounts.map((a) => {
    const lastSeen = a.servers
      .map(s => s.lastSeenAt)
      .sort((x, y) => (x > y ? -1 : 1))[0]
    return {
      _type: "account" as const,
      key: `account-${tree.deviceId}-${a.gameAccount}`,
      gameAccount: a.gameAccount,
      banned: a.banned,
      banReason: a.banReason,
      lastSeenAt: lastSeen,
      children: a.servers.map(s => ({
        _type: "server" as const,
        key: `server-${tree.deviceId}-${a.gameAccount}-${s.serverLabel}`,
        serverLabel: s.serverLabel,
        cardCode: s.cardCode,
        lastSeenAt: s.lastSeenAt,
        firstSeenAt: s.firstSeenAt,
        banned: false,
        banReason: null,
        children: s.roles.map(r => ({
          _type: "role" as const,
          key: `role-${tree.deviceId}-${a.gameAccount}-${s.serverLabel}-${r.id || r.name}`,
          roleName: r.name,
          roleId: r.id,
          lvl: r.lvl,
          banned: r.banned,
          banReason: r.banReason
        }))
      }))
    } as TreeRow
  })
}

function doSearch() {
  fetchData()
}

function onKeywordEnter() {
  fetchData()
}

/** 主列名称渲染辅助 */
function rowTitle(row: any): string {
  if (row._type === "device") return maskDeviceId(row.deviceId || "")
  if (row._type === "account") return row.gameAccount || "-"
  if (row._type === "server") return row.serverLabel || "-"
  return prettyRoleName(row.roleName)
}

function rowSub(row: any): string {
  if (row._type === "device") return ``
  if (row._type === "account") return ``
  if (row._type === "server") return row.cardCode ? `卡密 ${row.cardCode}` : ""
  return row.lvl ? `Lv.${row.lvl}` : ""
}

/** 脱敏展示设备码 */
function maskDeviceId(id: string): string {
  if (!id) return "-"
  if (id.length <= 8) return id
  return `${id.slice(0, 4)}****${id.slice(-4)}`
}

/** 角色名短展示（去掉 [xx区] 前缀） */
function prettyRoleName(name?: string): string {
  if (!name) return "-"
  return name.replace(/^\[[^\]]*\]/, "")
}

/** ===== 封禁 ===== */
const banDialog = reactive({
  visible: false,
  submitting: false,
  type: "account" as "account" | "device" | "card" | "role",
  targetValue: "",
  reason: "",
  cascade: false
})

function openBanOn(type: "account" | "device" | "card" | "role", value: string, cascade = false) {
  banDialog.type = type
  banDialog.targetValue = value
  banDialog.reason = ""
  banDialog.cascade = cascade
  banDialog.visible = true
}

function onBanDevice(row: any) {
  openBanOn("device", row.deviceId || "")
}
function onBanAccount(row: any) {
  openBanOn("account", row.gameAccount || "", true)
}
function onBanRole(row: any) {
  openBanOn("role", row.roleName || row.roleId || "")
}

async function submitBan() {
  if (!banDialog.targetValue.trim()) {
    ElMessage.warning("请输入封禁目标")
    return
  }
  banDialog.submitting = true
  try {
    const { data } = await banPlayerApi(
      banDialog.type,
      banDialog.targetValue.trim(),
      banDialog.reason.trim() || undefined,
      banDialog.cascade
    )
    ElMessage.success(`已封禁（新增 ${data.added} 条记录）`)
    banDialog.visible = false
    await fetchData()
    if (bansDialog.visible) await fetchBans()
  } catch (e: any) {
    if (e?.message) ElMessage.error(e.message)
  } finally {
    banDialog.submitting = false
  }
}

/** ===== 解封（按层级）===== */
async function handleUnban(row: any) {
  const type = row._type === "account" ? "account" : row._type === "role" ? "role" : "device"
  const value
    = row._type === "account"
      ? row.gameAccount
      : row._type === "role"
        ? row.roleName || row.roleId
        : row.deviceId
  if (!value) return
  try {
    await ElMessageBox.confirm(`确定解封「${typeLabel(type)}」 ${value}？`, "提示", { type: "info" })
  } catch {
    return
  }
  try {
    await unbanPlayerApi(type, value)
    ElMessage.success("已解封")
    await fetchData()
    if (bansDialog.visible) await fetchBans()
  } catch (e: any) {
    ElMessage.error(e?.message || "操作失败")
  }
}

/** ===== 封禁名单 ===== */
const bansDialog = reactive({ visible: false, loading: false })
const bans = ref<AccountBanData[]>([])

async function fetchBans() {
  bansDialog.loading = true
  try {
    const { data } = await getAccountBansApi()
    bans.value = data.items
  } catch { /* */ } finally {
    bansDialog.loading = false
  }
}

function openBansDialog() {
  bansDialog.visible = true
  fetchBans()
}

async function handleUnbanRow(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定解封「${typeLabel(row.targetType)}」 ${row.targetValue}？`,
      "提示",
      { type: "info" }
    )
  } catch {
    return
  }
  try {
    await unbanPlayerApi(row.targetType, row.targetValue)
    ElMessage.success("已解封")
    await fetchBans()
    await fetchData()
  } catch (e: any) {
    ElMessage.error(e?.message || "操作失败")
  }
}

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    account: "账号",
    device: "设备",
    card: "卡密",
    role: "角色"
  }
  return map[t] || t
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="app-container">
    <!-- 统计 -->
    <el-row :gutter="12" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #409eff">
            {{ statDevice }}
          </div>
          <div class="stat-label">
            关联设备
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #67c23a">
            {{ statOnline }}
          </div>
          <div class="stat-label">
            正常在线
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #f56c6c">
            {{ statBanned }}
          </div>
          <div class="stat-label">
            已封设备
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value" style="color: #909399">
            树形追踪
          </div>
          <div class="stat-label">
            设备→账号→区服→角色
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索 + 树形列表 -->
    <el-card shadow="never">
      <div class="table-header">
        <span class="header-title">玩家设备树（点击设备展开其账号 / 区服 / 角色）</span>
        <div class="header-actions">
          <el-input
            v-model="keyword"
            placeholder="搜索 账号 / 设备码 / 卡号 / 角色名"
            clearable
            size="small"
            style="width: 280px"
            @keyup.enter="onKeywordEnter"
            @clear="doSearch"
          >
            <template #append>
              <el-button @click="doSearch">
                搜索
              </el-button>
            </template>
          </el-input>
          <el-button size="small" type="danger" plain @click="openBansDialog">
            封禁名单
          </el-button>
          <el-button size="small" @click="fetchData">
            刷新
          </el-button>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="topRows"
        row-key="key"
        lazy
        :load="loadTree"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        class="tree-table"
      >
        <el-table-column label="名称" min-width="280">
          <template #default="{ row }">
            <span class="row-main">
              <el-tag
                v-if="row._type === 'device'"
                size="small"
                :type="row.banned ? 'danger' : row.online ? 'success' : 'info'"
                effect="plain"
              >
                {{ row.banned ? "设备·封" : row.online ? "设备·在线" : "设备" }}
              </el-tag>
              <el-tag
                v-else-if="row._type === 'account'" size="small" type="warning" effect="plain"
                :class="row.banned ? 'tag-banned' : ''"
              >
                账号
              </el-tag>
              <el-tag v-else-if="row._type === 'server'" size="small" type="info" effect="plain">
                区服
              </el-tag>
              <el-tag
                v-else-if="row._type === 'role'" size="small" effect="plain"
                :type="row.banned ? 'danger' : 'primary'"
              >
                角色
              </el-tag>

              <span class="row-title" :class="{ 'text-banned': row.banned }">{{ rowTitle(row) }}</span>
              <span v-if="rowSub(row)" class="row-sub">{{ rowSub(row) }}</span>
              <el-tag v-if="row._type === 'device' && row.banned" type="danger" size="small" class="ml6">
                {{ row.banReason || "已封禁" }}
              </el-tag>
            </span>
          </template>
        </el-table-column>

        <el-table-column label="画像摘要" min-width="220">
          <template #default="{ row }">
            <span v-if="row._type === 'device'" class="dim-text">
              {{ row.accountCount }} 账号 / {{ row.serverCount }} 区服 / {{ row.roleCount }} 角色
            </span>
            <span v-else-if="row._type === 'account'" class="dim-text">
              {{ row.children?.length || 0 }} 个区服
            </span>
            <span v-else-if="row._type === 'server'" class="dim-text">
              {{ row.children?.length || 0 }} 个角色
              <span v-if="row.cardCode"> · {{ row.cardCode }}</span>
            </span>
            <span v-else class="dim-text">-</span>
          </template>
        </el-table-column>

        <el-table-column label="最近登录" width="140">
          <template #default="{ row }">
            <span v-if="row.lastSeenAt">{{ dayjs(row.lastSeenAt).format("MM-DD HH:mm") }}</span>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>

        <el-table-column label="首次出现" width="140">
          <template #default="{ row }">
            <span v-if="row.firstSeenAt">{{ dayjs(row.firstSeenAt).format("MM-DD HH:mm") }}</span>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="130" align="center" fixed="right">
          <template #default="{ row }">
            <template v-if="row._type === 'device'">
              <el-button v-if="row.banned" link type="success" size="small" @click="handleUnban(row)">
                解封设备
              </el-button>
              <el-button v-else link type="danger" size="small" @click="onBanDevice(row)">
                封此设备
              </el-button>
            </template>
            <template v-else-if="row._type === 'account'">
              <el-button v-if="row.banned" link type="success" size="small" @click="handleUnban(row)">
                解封账号
              </el-button>
              <el-button v-else link type="danger" size="small" @click="onBanAccount(row)">
                封此账号
              </el-button>
            </template>
            <template v-else-if="row._type === 'role'">
              <el-button v-if="row.banned" link type="success" size="small" @click="handleUnban(row)">
                解封
              </el-button>
              <el-button v-else link type="danger" size="small" @click="onBanRole(row)">
                封此角色
              </el-button>
            </template>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>

        <template #empty>
          <span style="color:#909399">
            暂无数据 — 玩家使用启动器登录游戏（获取到角色）后会自动出现在这里
          </span>
        </template>
      </el-table>
    </el-card>

    <!-- 封禁弹窗 -->
    <el-dialog v-model="banDialog.visible" title="封禁玩家" width="520px" :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="封禁层级">
          <el-radio-group v-model="banDialog.type">
            <el-radio-button value="account">
              账号
            </el-radio-button>
            <el-radio-button value="device">
              设备
            </el-radio-button>
            <el-radio-button value="card">
              卡密
            </el-radio-button>
            <el-radio-button value="role">
              角色
            </el-radio-button>
          </el-radio-group>
          <div class="tip">
            账号级：该账号在任何设备 / 任何新卡密登录都会被拒绝，并连带已有关联设备与卡密。
          </div>
        </el-form-item>
        <el-form-item label="封禁目标">
          <el-input v-model="banDialog.targetValue" placeholder="账号名 / 设备码 / 卡号 / 角色名" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="banDialog.reason" placeholder="封禁原因（如：恶意扰乱）" />
        </el-form-item>
        <el-form-item v-if="banDialog.type === 'account'" label="连带">
          <el-switch v-model="banDialog.cascade" />
          <span class="tip">开启 = 同时封禁该账号历史关联的全部设备与卡密（推荐）</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="banDialog.visible = false">
          取消
        </el-button>
        <el-button type="danger" :loading="banDialog.submitting" @click="submitBan">
          确定封禁
        </el-button>
      </template>
    </el-dialog>

    <!-- 封禁名单 -->
    <el-dialog v-model="bansDialog.visible" title="封禁名单" width="720px">
      <el-table v-loading="bansDialog.loading" :data="bans" size="small" max-height="460">
        <el-table-column label="层级" width="70" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.targetType === 'account' ? 'danger' : 'warning'">
              {{ typeLabel(row.targetType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="目标" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <code class="code-text">{{ row.targetValue }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.reason || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="bannedBy" label="操作人" width="90" />
        <el-table-column label="封禁时间" width="150">
          <template #default="{ row }">
            {{ dayjs(row.createdAt).format("MM-DD HH:mm") }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button link type="success" size="small" @click="handleUnbanRow(row)">
              解封
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
.row-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.row-title {
  font-size: 13px;
  font-weight: 600;
}
.row-title.text-banned {
  color: var(--el-color-danger);
  text-decoration: line-through;
}
.row-sub {
  font-size: 12px;
  color: #909399;
}
.dim-text {
  font-size: 12px;
  color: #909399;
}
.tag-banned {
  opacity: 0.6;
}
.code-text {
  font-family: "Consolas", monospace;
  font-size: 13px;
}
.tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 4px;
  width: 100%;
}
.ml6 {
  margin-left: 6px;
}
.tree-table :deep(.el-table__expanded-cell) {
  padding: 0;
}
</style>
