<script lang="ts" setup>
import type { FormRules } from "element-plus"
import { getConfigApi, updateConfigApi } from "@@/apis/config"

defineOptions({ name: "SystemConfig" })

const loading = ref(false)
const saveLoading = ref(false)
const formRef = useTemplateRef("formRef")
const activeTab = ref("basic")
// 勾选的支付方式（用户端展示 + 联动校验）
const enabledPayments = ref<string[]>([])

// 配置表单
const configForm = reactive({
  site_name: "",
  launcher_title: "",
  site_url: "",
  backend_url: "",
  buy_url: "",
  payment_provider: "epay",
  payment_methods: "[]",
  payment_gateway_priority: "epay",
  epay_url: "",
  epay_pid: "",
  epay_key: "",
  epay_payment_type: "alipay",
  shujie_url: "https://www.shujiepay.com",
  shujie_pid: "",
  shujie_private_key: "",
  shujie_platform_public_key: "",
  shujie_payment_type: "alipay",
  shujie_notify_url: "",
  wxpay_mchid: "",
  wxpay_appid: "",
  wxpay_api_v3_key: "",
  wxpay_private_key: "",
  wxpay_serial_no: "",
  wxpay_platform_cert: "",
  wxpay_notify_url: "",
  alipay_app_id: "",
  alipay_private_key: "",
  alipay_public_key: "",
  alipay_notify_url: "",
  contact_qq: "",
  downloadItems: [] as { name: string, url: string }[]
})

/** URL 格式校验 */
function urlValidator(_rule: unknown, value: string, callback: (error?: Error) => void) {
  if (!value) {
    callback(new Error("此项为必填"))
    return
  }
  if (URL.canParse(value)) {
    callback()
  } else {
    callback(new Error("请输入有效的 URL（以 http:// 或 https:// 开头）"))
  }
}

const formRules: FormRules = {
  site_url: [
    { required: true, message: "站点 URL 不能为空", trigger: "blur" },
    { validator: urlValidator, trigger: "blur" }
  ],
  backend_url: [
    { required: true, message: "后端地址不能为空", trigger: "blur" },
    { validator: urlValidator, trigger: "blur" }
  ],
  epay_url: [
    { required: true, message: "码支付网关不能为空", trigger: "blur" },
    { validator: urlValidator, trigger: "blur" }
  ],
  epay_pid: [{ required: true, message: "商户 PID 不能为空", trigger: "blur" }],
  epay_key: [
    { required: true, message: "商户密钥不能为空", trigger: "blur" },
    { min: 8, message: "密钥长度至少 8 个字符", trigger: "blur" }
  ],
  shujie_url: [
    { required: true, message: "接口地址不能为空", trigger: "blur" },
    { validator: urlValidator, trigger: "blur" }
  ],
  shujie_pid: [{ required: true, message: "商户 ID 不能为空", trigger: "blur" }]
}

async function loadConfig() {
  loading.value = true
  try {
    const { data } = await getConfigApi()
    configForm.site_name = data.site_name || ""
    configForm.launcher_title = data.launcher_title || ""
    configForm.site_url = data.site_url || ""
    configForm.backend_url = data.backend_url || ""
    configForm.buy_url = data.buy_url || data.site_url || ""
    configForm.payment_provider = data.payment_provider || "epay"
    // 已启用的支付通道（JSON → 数组，容错）：直连 alipay/wxpay；网关 epay/shujie
    try {
      const methods = JSON.parse(data.payment_methods || "[]")
      const valid = ["alipay", "wxpay", "epay", "shujie"]
      enabledPayments.value = Array.isArray(methods) ? methods.filter((m: string) => valid.includes(m)) : []
    } catch {
      enabledPayments.value = []
    }
    if (enabledPayments.value.length === 0) enabledPayments.value = ["alipay"]
    configForm.payment_gateway_priority = data.payment_gateway_priority === "shujie" ? "shujie" : "epay"
    configForm.epay_url = data.epay_url || ""
    configForm.epay_pid = data.epay_pid || ""
    configForm.epay_key = data.epay_key || ""
    configForm.epay_payment_type = data.epay_payment_type || "alipay"
    configForm.shujie_url = data.shujie_url || "https://www.shujiepay.com"
    configForm.shujie_pid = data.shujie_pid || ""
    configForm.shujie_private_key = data.shujie_private_key || ""
    configForm.shujie_platform_public_key = data.shujie_platform_public_key || ""
    configForm.shujie_payment_type = data.shujie_payment_type || "alipay"
    configForm.shujie_notify_url = data.shujie_notify_url || ""
    configForm.wxpay_mchid = data.wxpay_mchid || ""
    configForm.wxpay_appid = data.wxpay_appid || ""
    configForm.wxpay_api_v3_key = data.wxpay_api_v3_key || ""
    configForm.wxpay_private_key = data.wxpay_private_key || ""
    configForm.wxpay_serial_no = data.wxpay_serial_no || ""
    configForm.wxpay_platform_cert = data.wxpay_platform_cert || ""
    configForm.wxpay_notify_url = data.wxpay_notify_url || ""
    configForm.contact_qq = data.contact_qq || ""
    // 网盘下载列表：JSON 字符串 → 数组（容错）
    try {
      const parsed = JSON.parse(data.download_items || "[]")
      configForm.downloadItems = Array.isArray(parsed) ? parsed : []
    } catch {
      configForm.downloadItems = []
    }
    configForm.alipay_app_id = data.alipay_app_id || ""
    configForm.alipay_private_key = data.alipay_private_key || ""
    configForm.alipay_public_key = data.alipay_public_key || ""
    configForm.alipay_notify_url = data.alipay_notify_url || ""
  } catch { /* */ } finally {
    loading.value = false
  }
}

/** 校验勾选的支付方式配置是否完整（不完整阻止保存） */
function validatePayments(): string | null {
  if (enabledPayments.value.includes("alipay")) {
    const appId = configForm.alipay_app_id.trim()
    const priv = configForm.alipay_private_key.trim()
    const pub = configForm.alipay_public_key.trim()
    if (!appId || !priv || priv.length < 10 || !pub || pub.length < 10) {
      return "已勾选【支付宝】，请完善：应用 APPID / 应用私钥 / 支付宝公钥"
    }
  }
  if (enabledPayments.value.includes("wxpay")) {
    const { wxpay_mchid: mchid, wxpay_appid: appid, wxpay_api_v3_key: v3, wxpay_private_key: pk, wxpay_serial_no: sn } = configForm
    if (!mchid.trim() || !appid.trim() || !v3.trim() || !pk.trim() || !sn.trim()) {
      return "已勾选【微信支付】，请完善：商户号 / AppID / APIv3密钥 / 商户私钥 / 证书序列号"
    }
  }
  if (enabledPayments.value.includes("epay")) {
    const { epay_url: url, epay_pid: pid, epay_key: key } = configForm
    if (!url.trim() || !pid.trim() || !key.trim()) {
      return "已勾选【易支付】，请完善：网关地址 / 商户 PID / 商户密钥"
    }
  }
  if (enabledPayments.value.includes("shujie")) {
    const {
      shujie_url: url,
      shujie_pid: pid,
      shujie_private_key: priv,
      shujie_platform_public_key: pub
    } = configForm
    if (!url.trim() || !pid.trim() || !priv.trim() || !pub.trim()) {
      return "已勾选【数捷Pay】，请完善：接口地址 / 商户 ID / 商户私钥 / 平台公钥"
    }
  }
  return null
}

/**
 * 未勾选的通道一律提交空值（而不是沿用表单里的旧值）。
 * 后端会把空值落库，从而清掉上一次留存下来的配置 ——
 * 保证「取消勾选 → 保存」之后，再次勾选时看到的是一份干净的空配置，不会复用上次的内容。
 */
function gate(channel: string, value: string): string {
  return enabledPayments.value.includes(channel) ? value : ""
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  // 支付方式配置完整性校验
  const payErr = validatePayments()
  if (payErr) {
    activeTab.value = "payment"
    ElMessage.warning(payErr)
    return
  }
  try {
    await ElMessageBox.confirm("确定保存配置？修改支付相关设置可能影响线上交易。", "保存确认", { type: "warning" })
  } catch {
    return
  }
  saveLoading.value = true
  try {
    await updateConfigApi({
      site_name: configForm.site_name,
      launcher_title: configForm.launcher_title,
      site_url: configForm.site_url,
      backend_url: configForm.backend_url,
      buy_url: configForm.buy_url,
      payment_provider: configForm.payment_provider,
      payment_methods: JSON.stringify(enabledPayments.value),
      payment_gateway_priority: configForm.payment_gateway_priority,
      epay_url: gate("epay", configForm.epay_url),
      epay_pid: gate("epay", configForm.epay_pid),
      epay_key: gate("epay", configForm.epay_key),
      epay_payment_type: gate("epay", configForm.epay_payment_type),
      shujie_url: gate("shujie", configForm.shujie_url),
      shujie_pid: gate("shujie", configForm.shujie_pid),
      shujie_private_key: gate("shujie", configForm.shujie_private_key),
      shujie_platform_public_key: gate("shujie", configForm.shujie_platform_public_key),
      shujie_payment_type: gate("shujie", configForm.shujie_payment_type),
      shujie_notify_url: gate("shujie", configForm.shujie_notify_url),
      wxpay_mchid: gate("wxpay", configForm.wxpay_mchid),
      wxpay_appid: gate("wxpay", configForm.wxpay_appid),
      wxpay_api_v3_key: gate("wxpay", configForm.wxpay_api_v3_key),
      wxpay_private_key: gate("wxpay", configForm.wxpay_private_key),
      wxpay_serial_no: gate("wxpay", configForm.wxpay_serial_no),
      wxpay_platform_cert: gate("wxpay", configForm.wxpay_platform_cert),
      wxpay_notify_url: gate("wxpay", configForm.wxpay_notify_url),
      alipay_app_id: gate("alipay", configForm.alipay_app_id),
      alipay_private_key: gate("alipay", configForm.alipay_private_key),
      alipay_public_key: gate("alipay", configForm.alipay_public_key),
      alipay_notify_url: gate("alipay", configForm.alipay_notify_url),
      contact_qq: configForm.contact_qq,
      download_items: JSON.stringify(configForm.downloadItems.filter(i => i.url && i.url.trim()))
    })
    ElMessage.success("保存成功")
    loadConfig()
  } catch { /* */ } finally {
    saveLoading.value = false
  }
}

onMounted(() => loadConfig())
</script>

<template>
  <div class="app-container">
    <el-tabs v-model="activeTab" class="config-tabs">
      <el-tab-pane label="基础配置" name="basic">
        <el-card shadow="never">
          <template #header>
            <span class="card-title">站点配置</span>
          </template>
          <el-form ref="formRef" :model="configForm" :rules="formRules" label-width="120px" v-loading="loading">
            <el-form-item label="站点名称">
              <el-input v-model="configForm.site_name" placeholder="仙域启动器" />
            </el-form-item>
            <el-form-item label="启动器标题">
              <el-input v-model="configForm.launcher_title" placeholder="留空则用站点名称（启动器窗口标题原样展示，如：仙域启动器 群号:11111111）" />
              <div class="el-form-item__tip">
                启动器窗口标题会原样展示此内容，可包含公告/群号等，留空显示"仙域启动器"
              </div>
            </el-form-item>
            <el-form-item label="站点 URL" prop="site_url" required>
              <el-input v-model="configForm.site_url" placeholder="https://example.com" />
              <div class="form-hint">
                购买页实际访问地址，支付完成后回跳至此
              </div>
            </el-form-item>
            <el-form-item label="后端地址" prop="backend_url" required>
              <el-input v-model="configForm.backend_url" placeholder="https://api.example.com" />
              <div class="form-hint">
                后端公网地址（支付平台直接回调此地址）
              </div>
            </el-form-item>
            <el-form-item label="购买页地址">
              <el-input v-model="configForm.buy_url" placeholder="https://example.com" />
              <div class="form-hint">
                启动器中「购买卡密」按钮跳转地址
              </div>
            </el-form-item>
            <el-form-item label="客服QQ群">
              <el-input v-model="configForm.contact_qq" placeholder="如 123456789（留空则页脚不显示）" />
              <div class="form-hint">
                用户端页脚「技术支持QQ群」显示此号码
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="支付配置" name="payment">
        <el-card shadow="never">
          <template #header>
            <span class="card-title">支付配置</span>
            <span class="card-subtitle">勾选启用的支付通道（直连 / 聚合网关）；勾选即展开对应配置，填写不完整无法保存</span>
          </template>
          <el-form :model="configForm" :rules="formRules" label-width="120px" v-loading="loading">
            <el-form-item label="支付方式">
              <el-checkbox-group v-model="enabledPayments">
                <el-checkbox value="alipay">
                  支付宝（电脑网站支付 · 直连）
                </el-checkbox>
                <el-checkbox value="wxpay">
                  微信支付（V3 直连扫码）
                </el-checkbox>
                <el-checkbox value="epay">
                  易支付（聚合网关）
                </el-checkbox>
                <el-checkbox value="shujie">
                  数捷Pay（聚合网关）
                </el-checkbox>
              </el-checkbox-group>
              <div class="form-hint">
                买家端固定只展示「支付宝 / 微信支付」两个入口，后端自动选路：优先直连通道，直连不可用时回退到已启用的聚合网关。勾选即展开对应配置，填写不完整将无法保存；至少勾选一项。
              </div>
            </el-form-item>

            <el-alert
              v-if="enabledPayments.length === 0"
              type="warning"
              :closable="false"
              show-icon
              title="请至少勾选一种支付方式"
              style="margin-bottom: 16px"
            />

            <el-form-item
              v-if="enabledPayments.includes('epay') && enabledPayments.includes('shujie')"
              label="网关优先级"
            >
              <el-radio-group v-model="configForm.payment_gateway_priority">
                <el-radio value="epay">
                  易支付优先
                </el-radio>
                <el-radio value="shujie">
                  数捷Pay优先
                </el-radio>
              </el-radio-group>
              <div class="form-hint">
                直连通道不可用时，按此顺序选择可用的聚合网关
              </div>
            </el-form-item>

            <template v-if="enabledPayments.includes('wxpay')">
              <el-divider content-position="left">
                微信支付 V3 直连（Native 扫码）<span class="required-tag">必填</span>
              </el-divider>
              <el-form-item label="商户号 mchid">
                <el-input v-model="configForm.wxpay_mchid" placeholder="16 位商户号" />
              </el-form-item>
              <el-form-item label="AppID">
                <el-input v-model="configForm.wxpay_appid" placeholder="wx..." />
                <div class="form-hint">
                  已绑定商户号的小程序/公众号 AppID
                </div>
              </el-form-item>
              <el-form-item label="APIv3 密钥">
                <el-input v-model="configForm.wxpay_api_v3_key" type="password" show-password placeholder="32 位 APIv3 密钥" />
              </el-form-item>
              <el-form-item label="商户私钥">
                <el-input v-model="configForm.wxpay_private_key" type="textarea" :rows="5" placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" />
                <div class="form-hint">
                  apiclient_key.pem 文件全文（商户平台 → API安全 → 管理证书下载）
                </div>
              </el-form-item>
              <el-form-item label="证书序列号">
                <el-input v-model="configForm.wxpay_serial_no" placeholder="商户证书序列号" />
              </el-form-item>
              <el-form-item label="平台证书(可选)">
                <el-input v-model="configForm.wxpay_platform_cert" type="textarea" :rows="3" placeholder="不填则后端自动从 /v3/certificates 拉取" />
              </el-form-item>
              <el-form-item label="回调地址(可选)">
                <el-input v-model="configForm.wxpay_notify_url" placeholder="https://后端地址/api/payment/wxnotify" />
                <div class="form-hint">
                  默认取「后端地址 + /api/payment/wxnotify」；请确保微信商户后台 notify_url 与此一致
                </div>
              </el-form-item>
            </template>

            <template v-if="enabledPayments.includes('alipay')">
              <el-divider content-position="left">
                支付宝电脑网站支付<span class="required-tag">必填</span>
              </el-divider>
              <el-form-item label="应用 APPID">
                <el-input v-model="configForm.alipay_app_id" placeholder="开放平台应用 APPID（如 202100...）" />
                <div class="form-hint">
                  支付宝开放平台 → 应用信息 → APPID（应用需已上线并开通电脑网站支付）
                </div>
              </el-form-item>
              <el-form-item label="应用私钥">
                <el-input v-model="configForm.alipay_private_key" type="textarea" :rows="5" placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" />
                <div class="form-hint">
                  支付宝开放平台密钥工具生成的「应用私钥 RSA2048」（PKCS8）全文
                </div>
              </el-form-item>
              <el-form-item label="支付宝公钥">
                <el-input v-model="configForm.alipay_public_key" type="textarea" :rows="5" placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----" />
                <div class="form-hint">
                  加签方式页面下载的 alipayPublicKey_RSA2.txt 全文（用于验签回调）
                </div>
              </el-form-item>
              <el-form-item label="回调地址(可选)">
                <el-input v-model="configForm.alipay_notify_url" placeholder="https://后端地址/api/payment/alipay/notify" />
                <div class="form-hint">
                  默认取「后端地址 + /api/payment/alipay/notify」
                </div>
              </el-form-item>
            </template>

            <template v-if="enabledPayments.includes('epay')">
              <el-divider content-position="left">
                易支付（聚合网关 · 直连不可用时回退）<span class="required-tag">必填</span>
              </el-divider>
              <el-form-item label="网关地址" prop="epay_url">
                <el-input v-model="configForm.epay_url" placeholder="https://epay.example.com/submit.php" />
                <div class="form-hint">
                  易支付网关地址（含 /submit.php 或 /api/pay/submit）
                </div>
              </el-form-item>
              <el-form-item label="商户 PID" prop="epay_pid">
                <el-input v-model="configForm.epay_pid" placeholder="1001" />
              </el-form-item>
              <el-form-item label="商户密钥" prop="epay_key">
                <el-input v-model="configForm.epay_key" type="password" show-password placeholder="密钥" />
              </el-form-item>
              <el-form-item label="默认支付方式">
                <el-radio-group v-model="configForm.epay_payment_type">
                  <el-radio value="alipay">
                    支付宝
                  </el-radio>
                  <el-radio value="wxpay">
                    微信支付
                  </el-radio>
                  <el-radio value="qqpay">
                    QQ 钱包
                  </el-radio>
                </el-radio-group>
                <div class="form-hint">
                  买家所选支付方式无法识别时的兜底类型
                </div>
              </el-form-item>
            </template>

            <template v-if="enabledPayments.includes('shujie')">
              <el-divider content-position="left">
                数捷Pay（聚合网关 · V2 RSA 签名 · 直连不可用时回退）<span class="required-tag">必填</span>
              </el-divider>
              <el-form-item label="接口地址" prop="shujie_url">
                <el-input v-model="configForm.shujie_url" placeholder="https://www.shujiepay.com" />
                <div class="form-hint">
                  数捷Pay 接口地址，后端实际请求「接口地址 + /api/pay/create」
                </div>
              </el-form-item>
              <el-form-item label="商户 ID" prop="shujie_pid">
                <el-input v-model="configForm.shujie_pid" placeholder="如 1867" />
              </el-form-item>
              <el-form-item label="商户私钥">
                <el-input v-model="configForm.shujie_private_key" type="textarea" :rows="5" placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" />
                <div class="form-hint">
                  商户后台 → API 信息 → 生成商户 RSA 密钥对后保存的【商户私钥】全文（用于签名）
                </div>
              </el-form-item>
              <el-form-item label="平台公钥">
                <el-input v-model="configForm.shujie_platform_public_key" type="textarea" :rows="5" placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----" />
                <div class="form-hint">
                  API 信息页的【平台公钥】全文（用于回调验签）
                </div>
              </el-form-item>
              <el-form-item label="默认支付方式">
                <el-radio-group v-model="configForm.shujie_payment_type">
                  <el-radio value="alipay">
                    支付宝
                  </el-radio>
                  <el-radio value="wxpay">
                    微信支付
                  </el-radio>
                  <el-radio value="qqpay">
                    QQ 钱包
                  </el-radio>
                </el-radio-group>
                <div class="form-hint">
                  买家所选支付方式无法识别时的兜底类型
                </div>
              </el-form-item>
              <el-form-item label="回调地址(可选)">
                <el-input v-model="configForm.shujie_notify_url" placeholder="https://后端地址/api/payment/shujie/notify" />
                <div class="form-hint">
                  默认取「后端地址 + /api/payment/shujie/notify」，请勿改成易支付的 notify 地址
                </div>
              </el-form-item>
            </template>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="资源下载" name="download">
        <el-card shadow="never">
          <template #header>
            <span class="card-title">资源下载</span>
            <span class="card-subtitle">用户端「资源下载」区展示，支持多个网盘（123/迅雷/蓝奏/百度等均可）</span>
          </template>
          <el-form :model="configForm" label-width="120px">
            <el-form-item label="下载列表">
              <div style="width: 100%">
                <div
                  v-for="(item, idx) in configForm.downloadItems"
                  :key="idx"
                  style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center"
                >
                  <el-input v-model="item.name" placeholder="网盘名称（如 123云盘）" style="width: 220px" />
                  <el-input v-model="item.url" placeholder="网盘链接 https://..." style="flex: 1" />
                  <el-button type="danger" plain size="small" @click="configForm.downloadItems.splice(idx, 1)">
                    删除
                  </el-button>
                </div>
                <el-button
                  type="primary"
                  plain
                  size="small"
                  @click="configForm.downloadItems.push({ name: '', url: '' })"
                >
                  + 添加网盘
                </el-button>
                <div class="form-hint" style="margin-top: 8px">
                  支持 123云盘、迅雷、蓝奏云、坚果云、115、腾讯微云等任意网盘链接，可添加 1~N 个；保存后用户端购买页自动展示。
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <div style="margin-top: 20px; text-align: center">
      <el-button type="primary" :loading="saveLoading" @click="handleSave" size="large">
        {{ saveLoading ? '保存中...' : '保存配置' }}
      </el-button>
      <div class="form-hint" style="margin-top: 8px">
        勾选的通道必须填写完整对应配置才能保存；买家端固定展示「支付宝 / 微信支付」，直连不可用时自动回退到已启用的聚合网关（易支付 / 数捷Pay）。
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.app-container {
  max-width: 720px;
  padding: 16px;
}
.card-title {
  font-weight: 600;
  font-size: 15px;
}
.card-subtitle {
  margin-left: 12px;
  font-size: 12px;
  color: #909399;
  font-weight: 400;
}
.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}
.required-tag {
  font-size: 12px;
  font-weight: 400;
  color: #f56c6c;
  margin-left: 8px;
}
.config-tabs {
  max-width: 860px;
}
.config-tabs :deep(.el-tabs__content) {
  padding-top: 8px;
}
</style>
