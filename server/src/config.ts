// ============================================================
// config.ts - 集中读取并校验环境变量
// 敏感配置（数据库连接、SMTP、JWT 密钥等）一律通过 .env 注入，
// 避免硬编码。首次加载时自动读取根目录的 .env 文件。
// ============================================================
import "dotenv/config";
import path from "path";

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const config = {
  // 服务端口
  port: num("PORT", 3000),

  // ---- 品牌信息（开源可自定义） ----
  brand: {
    name: process.env.BRAND_NAME || "工单系统",
    team: process.env.BRAND_TEAM || "管理团队",
  },

  // ---- MySQL ----
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: num("DB_PORT", 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "ticket_system",
  },

  // ---- SMTP ----
  mail: {
    host: process.env.MAIL_HOST || "",
    port: num("MAIL_PORT", 465),
    secure: process.env.MAIL_SECURE === "true", // true 表示使用 SSL（如 465 端口）
    user: process.env.MAIL_USER || "",
    pass: process.env.MAIL_PASS || "",
    // 默认发件人：<brand.name> <noreply@example.com>，可被 MAIL_FROM 覆盖
    from: process.env.MAIL_FROM || "",
  },

  // ---- 管理员鉴权 ----
  adminPassword: process.env.ADMIN_PASSWORD || "admin123456",
  jwt: {
    secret: process.env.JWT_SECRET || "dev_secret_please_change",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  // ---- 图片上传 ----
  upload: {
    dir: process.env.UPLOAD_DIR || path.resolve(__dirname, "../uploads"),
    maxSizeMb: num("MAX_IMAGE_SIZE_MB", 2),
    maxCount: num("MAX_IMAGE_COUNT", 9),
    // 允许的图片 MIME 类型
    allowedTypes: ["image/jpeg", "image/png"],
  },
};
