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
  epay_url: "",
  epay_pid: "",
  epay_key: "",
  plan_month_price: "29.90",
  plan_quarter_price: "69.90",
  plan_year_price: "199.00",
  plan_lifetime_price: "399.00"
})

/** URL 格式校验 */
const urlValidator = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error("此项为必填"))
    return
  }
  try {
    new URL(value)
    callback()
  } catch {
    callback(new Error("请输入有效的 URL（以 http:// 或 https:// 开头）"))
  }
}

/** 价格格式校验 */
const priceValidator = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
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
    configForm.epay_url = data.epay_url || ""
    configForm.epay_pid = data.epay_pid || ""
    configForm.epay_key = data.epay_key || ""
    configForm.plan_month_price = ((Number(data.plan_month_price) || 2990) / 100).toFixed(2)
    configForm.plan_quarter_price = ((Number(data.plan_quarter_price) || 6990) / 100).toFixed(2)
    configForm.plan_year_price = ((Number(data.plan_year_price) || 19900) / 100).toFixed(2)
    configForm.plan_lifetime_price = ((Number(data.plan_lifetime_price) || 39900) / 100).toFixed(2)
  } catch { /* */ }
  finally { loading.value = false }
}

async function handleSave() {
  // 表单校验 + 二次确认
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    await ElMessageBox.confirm("确定保存配置？修改支付相关设置可能影响线上交易。", "保存确认", { type: "warning" })
  } catch {
    // 用户取消
    return
  }
  saveLoading.value = true
  try {
    await updateConfigApi({
      site_name: configForm.site_name,
      site_url: configForm.site_url,
      backend_url: configForm.backend_url,
      buy_url: configForm.buy_url,
      epay_url: configForm.epay_url,
      epay_pid: configForm.epay_pid,
      epay_key: configForm.epay_key,
      plan_month_price: String(Math.round(Number(configForm.plan_month_price) * 100)),
      plan_quarter_price: String(Math.round(Number(configForm.plan_quarter_price) * 100)),
      plan_year_price: String(Math.round(Number(configForm.plan_year_price) * 100)),
      plan_lifetime_price: String(Math.round(Number(configForm.plan_lifetime_price) * 100))
    })
    ElMessage.success("保存成功")
    loadConfig() // 保存后重新加载，确认数据一致
  } catch { /* */ }
  finally { saveLoading.value = false }
}

onMounted(() => loadConfig())
</script>

<template>
  <div class="app-container">
    <el-card shadow="never">
      <template #header>支付配置</template>
      <el-form ref="formRef" :model="configForm" :rules="formRules" label-width="120px" v-loading="loading">
        <el-form-item label="站点名称">
          <el-input v-model="configForm.site_name" placeholder="仙域启动器" />
        </el-form-item>
        <el-form-item label="站点 URL" prop="site_url" required>
          <el-input v-model="configForm.site_url" placeholder="https://example.com" />
          <div class="form-hint">购买页实际访问地址，支付完成后回跳至此</div>
        </el-form-item>
        <el-form-item label="后端地址" prop="backend_url" required>
          <el-input v-model="configForm.backend_url" placeholder="https://api.example.com" />
          <div class="form-hint">后端公网地址（支付平台直接回调此地址，需配置 Nginx 反代或有公网 IP）</div>
        </el-form-item>
        <el-form-item label="购买页地址">
          <el-input v-model="configForm.buy_url" placeholder="https://example.com" />
          <div class="form-hint">启动器中「购买卡密」按钮跳转地址</div>
        </el-form-item>
        <el-form-item label="码支付网关" prop="epay_url" required>
          <el-input v-model="configForm.epay_url" placeholder="https://epay.example.com/submit.php" />
          <div class="form-hint">码支付 / 易支付 网关地址</div>
        </el-form-item>
        <el-form-item label="商户 PID" prop="epay_pid" required>
          <el-input v-model="configForm.epay_pid" placeholder="1001" />
        </el-form-item>
        <el-form-item label="商户密钥" prop="epay_key" required>
          <el-input v-model="configForm.epay_key" type="password" show-password placeholder="密钥" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <template #header>套餐价格</template>
      <el-form :model="configForm" :rules="formRules" label-width="120px" v-loading="loading">
        <el-form-item label="月卡" prop="plan_month_price">
          <el-input v-model="configForm.plan_month_price" placeholder="29.90" style="width: 200px">
            <template #prepend>¥</template>
          </el-input>
          <span class="form-hint"> / 30天</span>
        </el-form-item>
        <el-form-item label="季卡" prop="plan_quarter_price">
          <el-input v-model="configForm.plan_quarter_price" placeholder="69.90" style="width: 200px">
            <template #prepend>¥</template>
          </el-input>
          <span class="form-hint"> / 90天</span>
        </el-form-item>
        <el-form-item label="年卡" prop="plan_year_price">
          <el-input v-model="configForm.plan_year_price" placeholder="199.00" style="width: 200px">
            <template #prepend>¥</template>
          </el-input>
          <span class="form-hint"> / 365天</span>
        </el-form-item>
        <el-form-item label="永久卡" prop="plan_lifetime_price">
          <el-input v-model="configForm.plan_lifetime_price" placeholder="399.00" style="width: 200px">
            <template #prepend>¥</template>
          </el-input>
          <span class="form-hint"> / 永久</span>
        </el-form-item>
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
  max-width: 700px;
  padding: 16px;
}
.form-hint {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
}
</style>
