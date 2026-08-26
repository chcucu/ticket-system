<script setup lang="ts">
/**
 * 通用工单反馈单（黑白艺术字 · 苹果应用风）
 *
 * 所有逻辑集中在本单一 .vue 文件中：
 *   - 姓名 / 联系方式 / 问题描述 / 邮箱(选填) / 图片上传(≤9张，JPG/PNG，单张≤2MB)
 *   - 严格表单校验（必填、格式）
 *   - 提交：多部分表单 POST /api/ticket/submit
 *   - 成功：黑白风格提示 + 工单编号 + “查看记录”按钮
 *
 * 视觉：黑白高对比 + 大号艺术字标题 + Apple 式留白 / 圆角 / 细腻阴影
 * 自定义：品牌/文案/上传限制/主题色全部来自 app.config.ts，改配置即可换皮
 * 技术栈：Vue 3 + Composition API + Element Plus（全局主色覆盖为黑）+ SCSS
 */
import { reactive, ref, computed } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadFile, type UploadFiles, type UploadInstance } from "element-plus";
import { appConfig as cfg } from "../app.config";

// ---------- 接口地址与上传限制（来自 app.config.ts，可一键自定义） ----------
const API_BASE = cfg.api.base;
const MAX_IMAGE_COUNT = cfg.upload.maxCount;
const MAX_IMAGE_SIZE_MB = cfg.upload.maxSizeMb;
const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = cfg.upload.allowedTypes;
// 上传区文案（把 {{count}}/{{size}} 占位符替换为实际数值，避免模板解析冲突）
const UPLOAD_TIP = cfg.copy.uploadTip.replace("{{count}}", String(MAX_IMAGE_COUNT));
const UPLOAD_HINT = cfg.copy.uploadHint.replace("{{size}}", String(MAX_IMAGE_SIZE_MB));

// ------------------------------------------------------------------
// 1. 表单数据与校验规则
// ------------------------------------------------------------------
const formRef = ref<FormInstance>();

const form = reactive({
  username: "",
  contact: "",
  content: "",
  email: "", // 选填，用于接收处理结果通知
});

const rules: FormRules = {
  username: [
    { required: true, message: "请填写你的名字", trigger: "blur" },
    { min: 1, max: 30, message: "名字长度需在 1-30 个字符之间", trigger: "blur" },
  ],
  contact: [
    { required: true, message: "请填写联系方式", trigger: "blur" },
    { validator: validateContact, trigger: "blur" },
  ],
  content: [
    { required: true, message: "请填写你所遇到的问题", trigger: "blur" },
    { validator: validateContent, trigger: "blur" },
  ],
  email: [
    { validator: validateEmail, trigger: "blur" },
  ],
};

function validateContact(_rule: unknown, value: string, callback: (err?: Error) => void) {
  const v = (value ?? "").trim();
  if (!v) return callback(new Error("请填写联系方式"));
  const phoneRe = /^(1[3-9]\d{9})$|^(0\d{2,3}-?\d{7,8})$/;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const qqRe = /^[1-9]\d{4,10}$/;
  if (phoneRe.test(v) || emailRe.test(v) || qqRe.test(v) || v.length >= 4) {
    return callback();
  }
  return callback(new Error("请输入有效的 QQ / 微信 / 电话 / 邮箱"));
}

function validateContent(_rule: unknown, value: string, callback: (err?: Error) => void) {
  const v = (value ?? "").trim();
  if (!v) return callback(new Error("请填写你所遇到的问题"));
  if (v.length < 10) return callback(new Error("请至少填写 10 个字，尽量包含地点、时间与具体过程"));
  return callback();
}

function validateEmail(_rule: unknown, value: string, callback: (err?: Error) => void) {
  const v = (value ?? "").trim();
  if (!v) return callback();
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(v)) return callback(new Error("邮箱格式不正确"));
  return callback();
}

// ------------------------------------------------------------------
// 2. 图片上传
// ------------------------------------------------------------------
const uploadRef = ref<UploadInstance>();
const fileList = ref<UploadFile[]>([]);

const rawFiles = computed<File[]>(() =>
  fileList.value
    .map((f) => f.raw)
    .filter((f): f is File => Boolean(f))
);

function beforeImageUpload(rawFile: File): boolean {
  if (!ALLOWED_TYPES.includes(rawFile.type)) {
    ElMessage.warning("仅支持 JPG / PNG 格式图片");
    return false;
  }
  if (rawFile.size > MAX_IMAGE_BYTES) {
    ElMessage.warning(`单张图片不能超过 ${MAX_IMAGE_SIZE_MB}MB`);
    return false;
  }
  return true;
}

function handleChange(_file: UploadFile, uploadFiles: UploadFiles) {
  const invalid = uploadFiles.find((f) => f.raw && !beforeImageUpload(f.raw!));
  if (invalid) {
    const idx = uploadFiles.indexOf(invalid);
    if (idx > -1) uploadFiles.splice(idx, 1);
  }
}

function handleExceed(files: File[]) {
  ElMessage.warning(`最多只能上传 ${MAX_IMAGE_COUNT} 张图片，本次已忽略 ${files.length} 张`);
  if (fileList.value.length >= MAX_IMAGE_COUNT) {
    fileList.value.splice(MAX_IMAGE_COUNT);
  }
}

// ------------------------------------------------------------------
// 3. 提交逻辑
// ------------------------------------------------------------------
const submitting = ref(false);
const submitted = ref(false);
const ticketId = ref("");

const uploadedUrls = computed(() =>
  fileList.value.map((f) => f.url || (f.raw ? URL.createObjectURL(f.raw) : ""))
);

function handleSubmit() {
  if (!formRef.value) return;
  formRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.warning("请完善必填信息后再提交");
      return;
    }
    await doSubmit();
  });
}

async function doSubmit() {
  submitting.value = true;
  try {
    const fd = new FormData();
    fd.append("username", form.username.trim());
    fd.append("contact", form.contact.trim());
    fd.append("content", form.content.trim());
    fd.append("email", form.email.trim());
    for (const file of rawFiles.value) {
      fd.append("images", file, file.name);
    }

    const resp = await fetch(`${API_BASE}/ticket/submit`, {
      method: "POST",
      body: fd,
    });

    const data = await resp.json().catch(() => ({ success: false, message: "服务器返回异常" }));

    if (resp.ok && data.success) {
      ticketId.value = data.data?.ticket_id ?? "";
      submitted.value = true;
      ElMessage.success("提交成功");
    } else {
      ElMessage.error(data.message || "提交失败，请稍后重试");
      document.querySelector(".form-card")?.scrollIntoView({ behavior: "smooth" });
    }
  } catch (err) {
    console.error("[submit] 请求异常:", err);
    ElMessage.error("网络异常，请检查后端服务是否已启动");
  } finally {
    submitting.value = false;
  }
}

function handleBack() {
  submitted.value = false;
}

async function handleViewRecords() {
  await ElMessageBox.alert(cfg.copy.viewRecordsToast, "提示", {
    confirmButtonText: "知道了",
    type: "info",
  });
}
</script>

<template>
  <div
    class="page"
    :style="{
      '--brand-accent': cfg.theme.accent,
      '--brand-accent-text': cfg.theme.accentText,
    }"
  >
    <!-- ================= 顶部品牌横幅（黑白艺术字） ================= -->
    <header class="hero">
      <!-- 大号艺术字楼层氛围字 -->
      <span class="hero__num" aria-hidden="true">01</span>

      <div class="hero__inner">
        <p class="hero__eyebrow">{{ cfg.site.eyebrow }}</p>
        <h1 class="hero__title">{{ cfg.site.name }}</h1>
        <p class="hero__sub">{{ cfg.site.tagline }}</p>

        <div class="hero__meta">
          <span class="pill"><i class="dot"></i>{{ cfg.site.statusText }}</span>
          <span class="hint">{{ cfg.site.sla }}</span>
        </div>
      </div>

      <!-- 黑白线条山峦剪影 -->
      <svg class="hero__line" viewBox="0 0 1440 240" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,180 C200,140 320,220 520,170 C720,120 860,190 1060,150 C1200,122 1320,160 1440,130" fill="none" stroke="rgba(255,255,255,0.50)" stroke-width="2" />
        <path d="M0,205 C260,170 500,198 740,184 C980,170 1200,196 1440,180" fill="none" stroke="rgba(255,255,255,0.26)" stroke-width="1.5" />
        <path d="M120,120 L300,120" stroke="rgba(255,255,255,0.20)" stroke-width="1" />
        <path d="M1140,95 L1320,95" stroke="rgba(255,255,255,0.20)" stroke-width="1" />
      </svg>
    </header>

    <!-- ================= 表单主体 ================= -->
    <main
      v-if="!submitted"
      class="form-card"
      v-loading="submitting"
      element-loading-text="正在提交…"
      element-loading-background="rgba(255,255,255,0.72)"
    >
      <div class="section-head">
        <span class="section-no">01</span>
        <h2 class="section-title">{{ cfg.copy.sectionTitle }}</h2>
        <span class="section-line"></span>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="ticket-form"
      >
        <!-- 1. 姓名 -->
        <el-form-item prop="username">
          <template #label>
            <span class="field-head">
              <span class="field-no">01</span>
              <span class="field-label">{{ cfg.copy.nameLabel }}<em class="req">*</em></span>
              <span class="field-tip">{{ cfg.copy.nameTip }}</span>
            </span>
          </template>
          <el-input
            v-model="form.username"
            maxlength="30"
            show-word-limit
            :placeholder="cfg.copy.namePlaceholder"
            clearable
          />
        </el-form-item>

        <!-- 2. 联系方式 -->
        <el-form-item prop="contact">
          <template #label>
            <span class="field-head">
              <span class="field-no">02</span>
              <span class="field-label">{{ cfg.copy.contactLabel }}<em class="req">*</em></span>
              <span class="field-tip">{{ cfg.copy.contactTip }}</span>
            </span>
          </template>
          <el-input
            v-model="form.contact"
            maxlength="50"
            :placeholder="cfg.copy.contactPlaceholder"
            clearable
          />
        </el-form-item>

        <!-- 3. 问题描述 -->
        <el-form-item prop="content">
          <template #label>
            <span class="field-head">
              <span class="field-no">03</span>
              <span class="field-label">{{ cfg.copy.contentLabel }}<em class="req">*</em></span>
              <span class="field-tip">{{ cfg.copy.contentTip }}</span>
            </span>
          </template>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="6"
            maxlength="2000"
            show-word-limit
            resize="none"
            :placeholder="cfg.copy.contentPlaceholder"
          />
        </el-form-item>

        <!-- 4. 邮箱（选填） -->
        <el-form-item prop="email">
          <template #label>
            <span class="field-head">
              <span class="field-no">04</span>
              <span class="field-label">{{ cfg.copy.emailLabel }}</span>
              <span class="field-tip">{{ cfg.copy.emailTip }}</span>
            </span>
          </template>
          <el-input
            v-model="form.email"
            maxlength="100"
            :placeholder="cfg.copy.emailPlaceholder"
            clearable
          />
        </el-form-item>

        <!-- 5. 图片上传 -->
        <el-form-item>
          <template #label>
            <span class="field-head">
              <span class="field-no">05</span>
              <span class="field-label">{{ cfg.copy.uploadLabel }}</span>
              <span class="field-tip">{{ UPLOAD_TIP }}</span>
            </span>
          </template>
          <el-upload
            ref="uploadRef"
            v-model:file-list="fileList"
            list-type="picture-card"
            :accept="cfg.upload.accept"
            :auto-upload="false"
            :limit="MAX_IMAGE_COUNT"
            :before-upload="beforeImageUpload"
            :on-change="handleChange"
            :on-exceed="handleExceed"
          >
            <div class="plus-box">
              <el-icon :size="24"><Plus /></el-icon>
              <span>添加图片</span>
            </div>
            <template #tip>
              <div class="upload-tip">{{ UPLOAD_HINT }}</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
    </main>

    <!-- ================= 成功页（黑白） ================= -->
    <main v-else class="success">
      <div class="success__mark">
        <svg viewBox="0 0 80 80" class="success__check" aria-hidden="true">
          <path
            class="stroke"
            d="M20,42 L35,57 L61,25"
            fill="none" stroke="#ffffff" stroke-width="6"
            stroke-linecap="round" stroke-linejoin="round"
          />
        </svg>
      </div>
      <p class="success__eyebrow">{{ cfg.site.eyebrowSuccess }}</p>
      <h2 class="success__title">{{ cfg.copy.successTitle }}</h2>
      <p class="success__desc">{{ cfg.copy.successDesc }}</p>

      <div class="reciept">
        <div class="reciept__head">
          <span class="reciept__no">FEEDBACK · RECEIPT</span>
          <span class="reciept__tag">{{ cfg.copy.receiptTag }}</span>
        </div>
        <div class="reciept__row">
          <span class="reciept__label">{{ cfg.copy.receiptLabel }}</span>
          <span class="reciept__id">{{ ticketId || "TICKET-准备中" }}</span>
        </div>
        <div v-if="uploadedUrls.length" class="reciept__thumbs">
          <img v-for="(u, i) in uploadedUrls" :key="i" :src="u" :alt="`原因图 ${i + 1}`" />
        </div>
        <p class="reciept__note">{{ cfg.copy.receiptNote }}</p>
      </div>

      <div class="success__actions">
        <el-button class="view-btn" @click="handleViewRecords">{{ cfg.copy.viewRecords }}</el-button>
        <el-button class="again-btn" @click="handleBack">{{ cfg.copy.again }}</el-button>
      </div>
    </main>

    <!-- ================= 底部固定操作栏 ================= -->
    <footer v-if="!submitted" class="action-bar">
      <button class="save-btn" type="button" @click="ElMessage.info('草稿功能开发中')">{{ cfg.copy.saveDraft }}</button>
      <button class="submit-btn" :disabled="submitting" @click="handleSubmit">
        {{ submitting ? cfg.copy.submitting : cfg.copy.submit }}
      </button>
    </footer>
  </div>
</template>

<style lang="scss">
/* ------------------------------------------------------------
 * 多元化字体：三段式字族体系（黑白苹果风基调不变）
 *   1. 衬线中文（艺术标题）—— "Noto Serif SC"
 *   2. 几何展示字（大字、编号）—— "Bebas Neue"
 *   3. 等宽科技字（眉标、序号、标签）—— "JetBrains Mono"
 *   正文仍用 Apple 系统字体栈，保证可读性
 * ------------------------------------------------------------ */
@import url("https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Fraunces:opsz,wght@9..144,600;9..144,900&family=JetBrains+Mono:wght@400;600;700&family=Noto+Serif+SC:wght@600;900&display=swap");

/* ------------------------------------------------------------
 * 全局覆盖 Element Plus 主色为“黑白”体系
 * （Element 的 primary 用于按钮、选中态、上传卡片边框等）
 * ------------------------------------------------------------ */
:root {
  /* Element 主色跟随 app.config 的 theme.accent；未设置时回退近黑 */
  --el-color-primary: var(--brand-accent, #1d1d1f);
  --el-color-primary-light-3: #3a3a3c;
  --el-color-primary-light-5: #636366;
  --el-color-primary-light-7: #a1a1a6;
  --el-color-primary-light-8: #c7c7cc;
  --el-color-primary-light-9: #ececf0;
  --el-color-primary-dark-2: #000000;
  --el-color-success: var(--brand-accent, #1d1d1f);
}
</style>

<style scoped lang="scss">
// ------------------------------------------------------------
// 黑白艺术字 · 苹果应用风
// 色板：近黑 #0a0a0a / 主墨 #1d1d1f / 次级灰 / 极浅灰 #f5f5f7
// 字体：多元化组合（衬线标题 + 展示字 + 等宽 + 系统正文）
// ------------------------------------------------------------
$ink: #1d1d1f;
$ink-2: #6e6e73;
$ink-3: #aeaeb2;
$bg: #f5f5f7;
$line: #e3e3e6;

// 多元化字族
$font-serif: "Noto Serif SC", "Songti SC", "SimSun", serif;      // 衬线中文·艺术标题
$font-display: "Bebas Neue", "Futura", "Arial Narrow", sans-serif; // 几何展示字·大字/编号
$font-mono: "JetBrains Mono", "SF Mono", "Menlo", monospace;      // 等宽科技字·眉标/序号
$font-body: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
  "PingFang SC", "Helvetica Neue", sans-serif;                    // Apple 系统正文

.page {
  min-height: 100vh;
  background: $bg;
  font-family: $font-body;
  color: $ink;
  padding-bottom: 84px;
  padding-bottom: calc(84px + env(safe-area-inset-bottom));
  -webkit-font-smoothing: antialiased;
}

/* ================= 顶部横幅：黑色地块 + 艺术字 ================= */
.hero {
  position: relative;
  overflow: hidden;
  padding: 56px 24px 78px;
  background: var(--brand-accent, #0a0a0a); /* 跟随 app.config.theme.accent */
  color: #fff;

  &__inner { position: relative; z-index: 2; }

  // 大号氛围数字“01”（Bebas 展示字 → 巨大冲击力）
  &__num {
    position: absolute;
    top: -8px;
    right: -6px;
    z-index: 0;
    font-family: $font-display;
    font-size: 200px;
    font-weight: 400;
    line-height: 1;
    color: rgba(255, 255, 255, 0.06);
    letter-spacing: -6px;
    user-select: none;
  }

  &__eyebrow {
    margin: 0 0 18px;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 3px;
    color: rgba(255, 255, 255, 0.55);
  }

  // 艺术字主标题：衬线中文（Noto Serif SC），书法气质与无衬线层出对比
  &__title {
    margin: 0;
    font-family: $font-serif;
    font-size: 54px;
    font-weight: 900;
    letter-spacing: 4px;
    line-height: 1.1;
    background: linear-gradient(180deg, #ffffff 0%, #cdcdcd 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: 0 18px 44px rgba(0, 0, 0, 0.65);
  }

  &__sub {
    margin: 12px 0 0;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.78);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 26px;

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;

      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #d0d0d0;
        animation: pulse 1.8s ease-in-out infinite;
      }
    }

    .hint {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.55);
    }
  }

  // 底部线条山峦
  &__line {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 96px;
    opacity: 0.9;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.35; }
}

/* ================= 表单卡片 ================= */
.form-card {
  position: relative;
  z-index: 2;
  margin: -34px 16px 0;
  padding: 22px 20px 8px;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.02);
}

.section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;

  .section-no {
    font-family: $font-mono;
    font-size: 13px;
    font-weight: 700;
    color: $ink;
    letter-spacing: 1px;
  }
  .section-title {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    color: $ink;
  }
  .section-line {
    flex: 1;
    height: 1px;
    background: $line;
  }
}

.ticket-form {
  :deep(.el-form-item) { margin-bottom: 24px; }
  :deep(.el-form-item__label) { height: auto; margin-bottom: 10px; line-height: 1.5; }

  .field-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
  }

  .field-no {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 700;
    color: $ink-3;
    letter-spacing: 1px;
  }

  .field-label {
    font-family: $font-serif;
    font-size: 15px;
    font-weight: 700;
    color: $ink;
    .req { margin-left: 1px; color: #d70015; font-style: normal; }
  }

  .field-tip {
    margin-left: auto;
    font-size: 11px;
    color: $ink-3;
  }

  // 输入框苹果化：描边代替阴影、大圆角
  :deep(.el-input__wrapper),
  :deep(.el-textarea__inner) {
    border-radius: 12px;
    background: #fbfbfd;
  }

  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px #d8d8dc inset;
    &:hover { box-shadow: 0 0 0 1px #b0b0b6 inset; }
    &.is-focus {
      box-shadow: 0 0 0 1.5px $ink inset;
    }
  }

  :deep(.el-textarea__inner) {
    box-shadow: 0 0 0 1px #d8d8dc inset;
    border-radius: 12px;
    &:focus { box-shadow: 0 0 0 1.5px $ink inset; }
  }
}

.upload-tip { margin-top: 8px; font-size: 11px; color: $ink-3; }

.plus-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  color: $ink-2;
  font-size: 12px;
  font-weight: 500;
}

/* 上传卡片（继承全局主色 → 黑白描边） */
:deep(.el-upload--picture-card) {
  border: 1.5px dashed #c9c9ce;
  border-radius: 12px;
  background: #fbfbfd;
}
:deep(.el-upload-list--picture-card .el-upload-list__item) {
  border-radius: 12px;
}

/* ================= 底部固定操作栏 ================= */
/* 共享：主按钮扫光动效（鼠标/触屏划过时的光泽） */
@mixin shine {
  position: relative;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: -80%;
    width: 60%;
    height: 100%;
    background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.35), transparent);
    transform: skewX(-20deg);
    transition: left 0.55s ease;
    pointer-events: none;
  }
  &:hover::after { left: 130%; }
}

.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(18px) saturate(1.6);
  border-top: 1px solid rgba(0, 0, 0, 0.06);

  .save-btn {
    position: relative;
    flex: 0 0 auto;
    padding: 12px 16px;
    border: none;
    background: transparent;
    color: $ink-2;
    font-family: $font-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 1px;
    cursor: pointer;
    transition: color 0.2s ease;

    // 悬停出现的细下划线
    &::after {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 6px;
      width: 0;
      height: 2px;
      background: $ink;
      transition: width 0.25s ease, left 0.25s ease;
    }
    &:hover {
      color: $ink;
      &::after { width: 60%; left: 20%; }
    }
    &:active { opacity: 0.7; }
  }

  .submit-btn {
    @include shine;
    flex: 1;
    padding: 15px 0;
    border: none;
    border-radius: 999px;
    background: var(--brand-accent); /* 跟随 app.config.theme.accent */
    color: var(--brand-accent-text, #fff);
    font-family: $font-serif;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 6px;
    cursor: pointer;
    box-shadow:
      0 10px 24px rgba(0, 0, 0, 0.32),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
    transform: translateY(0);
    transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s;

    &:hover {
      box-shadow:
        0 12px 30px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.22);
      filter: brightness(1.12);
    }
    &:active {
      transform: translateY(1px) scale(0.99);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
    }
    &:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; &::after { display: none; } }
    &:focus-visible { outline: 3px solid rgba(0, 0, 0, 0.35); outline-offset: 2px; }
  }
}

/* ================= 成功页（黑白） ================= */
.success {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 20px 30px;
  text-align: center;
  animation: rise 0.5s cubic-bezier(0.22, 1, 0.36, 1);

  &__mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 92px;
    height: 92px;
    border-radius: 50%;
    background: var(--brand-accent);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
    animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  &__check .stroke {
    stroke-dasharray: 80;
    stroke-dashoffset: 80;
    animation: draw 0.6s 0.25s ease forwards;
  }

  &__eyebrow {
    margin: 26px 0 0;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 3px;
    color: $ink-3;
  }

  &__title {
    margin: 10px 0 0;
    font-family: $font-serif;
    font-size: 30px;
    font-weight: 900;
    letter-spacing: 2px;
    color: $ink;
  }

  &__desc {
    margin: 10px 0 0;
    font-size: 14px;
    color: $ink-2;
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 300px;
    margin-top: 28px;
  }

  .view-btn {
    width: 100%;
    height: 48px;
    border-radius: 999px;
    font-family: $font-serif;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 1px;
    border: 1.5px solid #c9c9ce;
    color: $ink-2;
    background: #fff;
    transition: transform 0.15s ease, border-color 0.2s ease, color 0.2s ease, background 0.2s ease;

    &:hover { border-color: $ink; color: $ink; background: #f7f7f9; }
    &:active { transform: scale(0.97); }
    &:focus-visible { outline: 3px solid rgba(0, 0, 0, 0.25); outline-offset: 2px; }
  }

  .again-btn {
    @include shine;
    width: 100%;
    height: 48px;
    border-radius: 999px;
    font-family: $font-serif;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 2px;
    border: none;
    background: var(--brand-accent);
    color: var(--brand-accent-text, #fff);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.18);
    transition: transform 0.15s ease, box-shadow 0.2s ease;

    &:hover { box-shadow: 0 10px 28px rgba(0, 0, 0, 0.34); opacity: 1; color: var(--brand-accent-text, #fff); filter: brightness(1.1); }
    &:active { transform: translateY(1px) scale(0.99); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.26); }
    &:focus-visible { outline: 3px solid rgba(0, 0, 0, 0.35); outline-offset: 2px; }
  }
}

/* 工单回执 */
.reciept {
  width: 100%;
  max-width: 340px;
  margin-top: 28px;
  padding: 18px 18px 16px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.08);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  &__no {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 2px;
    color: $ink-3;
  }
  &__tag {
    padding: 3px 10px;
    border: 1px solid $ink;
    border-radius: 999px;
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 2px;
    color: $ink;
  }

  &__row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  &__label {
    font-family: $font-mono;
    font-size: 12px;
    font-weight: 600;
    color: $ink-3;
    letter-spacing: 1px;
  }
  // 工单编号：Bebas 展示字大标题（字距舒展、签名式）
  &__id {
    font-family: $font-display;
    font-size: 34px;
    font-weight: 400;
    letter-spacing: 3px;
    color: var(--brand-accent);
    word-break: break-all;
  }

  &__thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
    justify-content: center;
    img {
      width: 54px;
      height: 54px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid $line;
    }
  }

  &__note {
    margin: 16px 0 0;
    padding-top: 14px;
    border-top: 1px dashed #dcdcdf;
    font-size: 11px;
    color: $ink-3;
    letter-spacing: 1px;
  }
}

@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes pop  { 0% { transform: scale(0.5); } 80% { transform: scale(1.06); } 100% { transform: scale(1); } }
@keyframes draw { to { stroke-dashoffset: 0; } }
</style>
