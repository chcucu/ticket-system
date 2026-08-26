/**
 * ============================================================
 * app.config.ts —— 站点可配置中心（开源自定义入口）
 *
 * 想换品牌/文案/配色/上传限制，只需修改本文件，无需改任何组件代码。
 * 默认配置保持"极简黑白"主题；把 accent 改为任意十六进制色值即可整体换肤。
 * ============================================================
 */

export interface AppConfig {
  /** 站点信息 */
  site: {
    /** 站点/品牌名称（页面大标题、顶部横幅） */
    name: string;
    /** 英文眉标（顶部小字 / 成功页小字） */
    eyebrow: string;
    /** 英文眉标（成功页变体） */
    eyebrowSuccess: string;
    /** 副标题 */
    tagline: string;
    /** 状态胶囊文字（"进行中"这类） */
    statusText: string;
    /** 服务承诺文案（SLA） */
    sla: string;
  };
  /** 表单字段与提示文案 */
  copy: {
    sectionTitle: string;
    nameLabel: string;
    nameTip: string;
    namePlaceholder: string;
    contactLabel: string;
    contactTip: string;
    contactPlaceholder: string;
    contentLabel: string;
    contentTip: string;
    contentPlaceholder: string;
    emailLabel: string;
    emailTip: string;
    emailPlaceholder: string;
    uploadLabel: string;
    uploadTip: string;
    uploadHint: string;
    submit: string;
    submitting: string;
    saveDraft: string;
    successTitle: string;
    successDesc: string;
    receiptLabel: string;
    receiptTag: string;
    receiptNote: string;
    viewRecords: string;
    again: string;
    viewRecordsToast: string;
  };
  /** 后端接口 */
  api: {
    base: string;
  };
  /** 图片上传限制（需与后端 .env 一致） */
  upload: {
    maxCount: number;
    maxSizeMb: number;
    allowedTypes: string[];
    accept: string;
  };
  /** 主题 */
  theme: {
    /** 强调色（主按钮 / 横幅 / 成功态 / 工单编号连用）。默认近黑，改成任意色即换肤 */
    accent: string;
    /** 强调色上的文字颜色（深色背景配浅字，反之亦然） */
    accentText: string;
  };
}

export const appConfig: AppConfig = {
  site: {
    name: "工单反馈",
    eyebrow: "FEEDBACK · SERVICE · TICKET",
    eyebrowSuccess: "FEEDBACK · RECEIVED",
    tagline: "移动端优先的工单反馈系统",
    statusText: "进行中",
    sla: "1～2 个工作日内处理",
  },

  copy: {
    sectionTitle: "填写信息",
    nameLabel: "名字",
    nameTip: "网络常用ID · 不公开",
    namePlaceholder: "点此输入你的名字",
    contactLabel: "联系方式",
    contactTip: "QQ / 微信号 / 电话 / 邮箱 任选其一 · 不公开",
    contactPlaceholder: "QQ：10001 / 电话：13800000000",
    contentLabel: "问题描述",
    contentTip: "请包含地点、时间与具体过程 · 不公开",
    contentPlaceholder:
      "例如：昨晚 20:00 在东南区域，操作时发生卡顿掉线，请复查…",
    emailLabel: "接收通知邮箱",
    emailTip: "选填 · 处理结果将发送到该邮箱",
    emailPlaceholder: "选填，如 you@example.com",
    uploadLabel: "上传图片",
    uploadTip: "作为证据 · 最多 {{count}} 张 · 不公开",
    uploadHint: "仅支持 JPG / PNG，单张不超过 {{size}}MB",
    submit: "提交",
    submitting: "提交中…",
    saveDraft: "存草稿",
    successTitle: "已提交",
    successDesc: "已收到你的反馈，我们会尽快处理",
    receiptLabel: "工单编号",
    receiptTag: "回执",
    receiptNote: "请妥善保管编号 · 后续沟通时便于快速定位",
    viewRecords: "查看记录",
    again: "再次反馈",
    viewRecordsToast: "“查看记录”功能开发中，敬请期待",
  },

  api: {
    base: "/api", // 开发经 vite 代理；生产同源托管
  },

  upload: {
    maxCount: 9,
    maxSizeMb: 2,
    allowedTypes: ["image/jpeg", "image/png"],
    accept: ".jpg,.jpeg,.png,image/jpeg,image/png",
  },

  theme: {
    accent: "#1d1d1f", // 默认近黑（苹果极简）；改为如 "#3f7df6" 即变蓝调
    accentText: "#ffffff",
  },
};
