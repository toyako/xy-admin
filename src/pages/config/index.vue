<script lang="ts" setup>
import type { FormRules } from "element-plus"
import { getConfigApi, updateConfigApi } from "@@/apis/config"

defineOptions({ name: "SystemConfig" })

const loading = ref(false)
const saveLoading = ref(false)
const formRef = useTemplateRef("formRef")

// 配置表单
const configForm = reactive({
  site_name: "",
  site_url: "",
  backend_url: "",
  buy_url: "",
  payment_provider: "epay",
  epay_url: "",
  epay_pid: "",
  epay_key: "",
  epay_payment_type: "alipay",
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
  downloadItems: [] as { name: string, url: string }[],
  plan_minute_price: "0.01",
  plan_hour_price: "0.10",
  plan_day_price: "1.00",
  plan_month_price: "29.90",
  plan_quarter_price: "69.90",
  plan_year_price: "199.00",
  plan_lifetime_price: "399.00"
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

/** 价格格式校验 */
function priceValidator(_rule: unknown, value: string, callback: (error?: Error) => void) {
  if (!value || value.trim() === "") {
    callback(new Error("价格不能为空"))
    return
  }
  const num = Number(value)
  if (isNaN(num) || num <= 0) {
    callback(new Error("请输入有效的正数价格"))
    return
  }
  callback()
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
  plan_minute_price: [{ validator: priceValidator, trigger: "blur" }],
  plan_hour_price: [{ validator: priceValidator, trigger: "blur" }],
  plan_day_price: [{ validator: priceValidator, trigger: "blur" }],
  plan_month_price: [{ validator: priceValidator, trigger: "blur" }],
  plan_quarter_price: [{ validator: priceValidator, trigger: "blur" }],
  plan_year_price: [{ validator: priceValidator, trigger: "blur" }],
  plan_lifetime_price: [{ validator: priceValidator, trigger: "blur" }]
}

async function loadConfig() {
  loading.value = true
  try {
    const { data } = await getConfigApi()
    configForm.site_name = data.site_name || ""
    configForm.site_url = data.site_url || ""
    configForm.backend_url = data.backend_url || ""
    configForm.buy_url = data.buy_url || data.site_url || ""
    configForm.payment_provider = data.payment_provider || "epay"
    configForm.epay_url = data.epay_url || ""
    configForm.epay_pid = data.epay_pid || ""
    configForm.epay_key = data.epay_key || ""
    configForm.epay_payment_type = data.epay_payment_type || "alipay"
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
    configForm.plan_minute_price = ((Number(data.plan_minute_price) || 1) / 100).toFixed(2)
    configForm.plan_hour_price = ((Number(data.plan_hour_price) || 10) / 100).toFixed(2)
    configForm.plan_day_price = ((Number(data.plan_day_price) || 100) / 100).toFixed(2)
    configForm.plan_month_price = ((Number(data.plan_month_price) || 2990) / 100).toFixed(2)
    configForm.plan_quarter_price = ((Number(data.plan_quarter_price) || 6990) / 100).toFixed(2)
    configForm.plan_year_price = ((Number(data.plan_year_price) || 19900) / 100).toFixed(2)
    configForm.plan_lifetime_price = ((Number(data.plan_lifetime_price) || 39900) / 100).toFixed(2)
  } catch { /* */ } finally {
    loading.value = false
  }
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    await ElMessageBox.confirm("确定保存配置？修改支付相关设置可能影响线上交易。", "保存确认", { type: "warning" })
  } catch {
    return
  }
  saveLoading.value = true
  try {
    await updateConfigApi({
      site_name: configForm.site_name,
      site_url: configForm.site_url,
      backend_url: configForm.backend_url,
      buy_url: configForm.buy_url,
      payment_provider: configForm.payment_provider,
      epay_url: configForm.epay_url,
      epay_pid: configForm.epay_pid,
      epay_key: configForm.epay_key,
      epay_payment_type: configForm.epay_payment_type,
      wxpay_mchid: configForm.wxpay_mchid,
      wxpay_appid: configForm.wxpay_appid,
      wxpay_api_v3_key: configForm.wxpay_api_v3_key,
      wxpay_private_key: configForm.wxpay_private_key,
      wxpay_serial_no: configForm.wxpay_serial_no,
      wxpay_platform_cert: configForm.wxpay_platform_cert,
      wxpay_notify_url: configForm.wxpay_notify_url,
      alipay_app_id: configForm.alipay_app_id,
      alipay_private_key: configForm.alipay_private_key,
      alipay_public_key: configForm.alipay_public_key,
      alipay_notify_url: configForm.alipay_notify_url,
      contact_qq: configForm.contact_qq,
      download_items: JSON.stringify(configForm.downloadItems.filter(i => i.url && i.url.trim())),
      plan_minute_price: String(Math.round(Number(configForm.plan_minute_price) * 100)),
      plan_hour_price: String(Math.round(Number(configForm.plan_hour_price) * 100)),
      plan_day_price: String(Math.round(Number(configForm.plan_day_price) * 100)),
      plan_month_price: String(Math.round(Number(configForm.plan_month_price) * 100)),
      plan_quarter_price: String(Math.round(Number(configForm.plan_quarter_price) * 100)),
      plan_year_price: String(Math.round(Number(configForm.plan_year_price) * 100)),
      plan_lifetime_price: String(Math.round(Number(configForm.plan_lifetime_price) * 100))
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
    <el-card shadow="never">
      <template #header>
        <span class="card-title">站点配置</span>
      </template>
      <el-form ref="formRef" :model="configForm" :rules="formRules" label-width="120px" v-loading="loading">
        <el-form-item label="站点名称">
          <el-input v-model="configForm.site_name" placeholder="仙域启动器" />
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

    <el-card shadow="never" style="margin-top: 16px">
      <template #header>
        <span class="card-title">支付配置</span>
      </template>
      <el-form :model="configForm" :rules="formRules" label-width="120px" v-loading="loading">
        <el-form-item label="支付通道">
          <el-radio-group v-model="configForm.payment_provider">
            <el-radio value="epay">
              聚合支付（易支付）
            </el-radio>
            <el-radio value="wxpay">
              微信支付（V3 直连扫码）
            </el-radio>
            <el-radio value="alipay">
              支付宝（电脑网站支付）
            </el-radio>
          </el-radio-group>
          <div class="form-hint">
            聚合支付：购买页跳转第三方收银台；微信支付：购买页显示二维码扫码支付；支付宝：购买页跳转支付宝收银台。微信凭证未填完整时自动回退聚合支付。
          </div>
        </el-form-item>

        <el-divider content-position="left">
          聚合支付（易支付）
        </el-divider>
        <el-form-item label="码支付网关" prop="epay_url" required>
          <el-input v-model="configForm.epay_url" placeholder="https://epay.example.com/submit.php" />
          <div class="form-hint">
            易支付网关地址（含 /submit.php 或 /api/pay/submit）
          </div>
        </el-form-item>
        <el-form-item label="商户 PID" prop="epay_pid" required>
          <el-input v-model="configForm.epay_pid" placeholder="1001" />
        </el-form-item>
        <el-form-item label="商户密钥" prop="epay_key" required>
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
        </el-form-item>

        <template v-if="configForm.payment_provider === 'wxpay'">
          <el-divider content-position="left">
            微信支付 V3 直连（Native 扫码）
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

        <template v-if="configForm.payment_provider === 'alipay'">
          <el-divider content-position="left">
            支付宝电脑网站支付
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
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
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

    <el-card shadow="never" style="margin-top: 16px">
      <template #header>
        <span class="card-title">套餐价格</span>
        <span class="card-subtitle">支持分钟/小时/日卡（测试用），月/季/年/永久卡</span>
      </template>
      <el-form :model="configForm" :rules="formRules" label-width="120px" v-loading="loading">
        <div class="price-grid">
          <div class="price-item">
            <el-form-item label="分钟卡" prop="plan_minute_price">
              <el-input v-model="configForm.plan_minute_price" placeholder="0.01" style="width: 160px">
                <template #prepend>
                  ¥
                </template>
              </el-input>
              <div class="form-hint">
                1分钟 · 测试用
              </div>
            </el-form-item>
          </div>
          <div class="price-item">
            <el-form-item label="小时卡" prop="plan_hour_price">
              <el-input v-model="configForm.plan_hour_price" placeholder="0.10" style="width: 160px">
                <template #prepend>
                  ¥
                </template>
              </el-input>
              <div class="form-hint">
                1小时 · 测试用
              </div>
            </el-form-item>
          </div>
          <div class="price-item">
            <el-form-item label="日卡" prop="plan_day_price">
              <el-input v-model="configForm.plan_day_price" placeholder="1.00" style="width: 160px">
                <template #prepend>
                  ¥
                </template>
              </el-input>
              <div class="form-hint">
                1天
              </div>
            </el-form-item>
          </div>
          <div class="price-item">
            <el-form-item label="月卡" prop="plan_month_price">
              <el-input v-model="configForm.plan_month_price" placeholder="29.90" style="width: 160px">
                <template #prepend>
                  ¥
                </template>
              </el-input>
              <div class="form-hint">
                30天
              </div>
            </el-form-item>
          </div>
          <div class="price-item">
            <el-form-item label="季卡" prop="plan_quarter_price">
              <el-input v-model="configForm.plan_quarter_price" placeholder="69.90" style="width: 160px">
                <template #prepend>
                  ¥
                </template>
              </el-input>
              <div class="form-hint">
                90天
              </div>
            </el-form-item>
          </div>
          <div class="price-item">
            <el-form-item label="年卡" prop="plan_year_price">
              <el-input v-model="configForm.plan_year_price" placeholder="199.00" style="width: 160px">
                <template #prepend>
                  ¥
                </template>
              </el-input>
              <div class="form-hint">
                365天
              </div>
            </el-form-item>
          </div>
          <div class="price-item">
            <el-form-item label="永久卡" prop="plan_lifetime_price">
              <el-input v-model="configForm.plan_lifetime_price" placeholder="399.00" style="width: 160px">
                <template #prepend>
                  ¥
                </template>
              </el-input>
              <div class="form-hint">
                永久
              </div>
            </el-form-item>
          </div>
        </div>
      </el-form>
    </el-card>

    <div style="margin-top: 20px; text-align: center">
      <el-button type="primary" :loading="saveLoading" @click="handleSave" size="large">
        {{ saveLoading ? '保存中...' : '保存配置' }}
      </el-button>
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
.price-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.price-item {
  .el-form-item {
    margin-bottom: 0;
  }
}
</style>
