// ============================================================
// index.ts - 通用工单系统后端入口（Express + TypeScript + MySQL）
// Node.js + TypeScript + Express + MySQL
// ============================================================
import express from "express";
import cors from "cors";
import type { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";

import { config } from "./config";
import { pool, checkDbConnection } from "./db";
import { fail } from "./utils/response";
import authRoutes from "./routes/auth";
import ticketRoutes from "./routes/ticket";

const app = express();

// ---------- 基础中间件 ----------
app.use(cors());            // 允许跨域（前端开发时常用）
app.use(express.json());    // 解析 JSON body
app.use(express.urlencoded({ extended: true })); // 解析表单 urlencoded

// 静态托管上传的图片（uploads 目录）
app.use("/uploads", express.static(config.upload.dir, { maxAge: "7d" }));

// ---------- 健康检查 ----------
app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "server is running", time: new Date().toISOString() });
});

// ---------- 业务路由 ----------
app.use("/api/auth", authRoutes);
app.use("/api/ticket", ticketRoutes);

// ============================================================
// 前端静态托管（可部署为单服务）
// 若存在 web 构建产物（默认位于 ../web-dist），则由本服务直接托管：
//   - 静态资源直出
//   - 非 /api、/uploads 的请求回退到 index.html（SPA 路由）
// 方便一键部署，免去单独配置 Nginx。
// ============================================================
const webDist = path.resolve(__dirname, "../web-dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  // SPA 回退：放行 API 与上传，其余路由交给前端
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
  console.log(`✔ 已托管前端页面: ${webDist}`);
} else {
  console.log(`ℹ 未发现前端构建产物(${webDist})，仅提供 API 服务。`);
}

// ---------- 404 兜底 ----------
app.use((_req, res) => {
  fail(res, 404, "接口不存在");
});

// ---------- 统一错误处理中间件 ----------
// 必须保留 4 个参数，Express 才会将其识别为错误处理中间件
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[global-error]", err);

  // multer 文件上传错误：给用户友好的中文提示
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === "LIMIT_FILE_SIZE" ? `单张图片不能超过 ${config.upload.maxSizeMb}MB` :
      err.code === "LIMIT_FILE_COUNT" ? `最多只能上传 ${config.upload.maxCount} 张图片` :
      err.code === "LIMIT_UNEXPECTED_FILE" ? "上传字段名必须为 images" :
      `上传失败：${err.message}`;
    return fail(res, 400, msg);
  }

  const msg =
    typeof err === "object" && err && "message" in err
      ? String((err as Error).message)
      : "服务器内部错误";

  // 校验类错误（如文件类型不合法）返回 400
  return fail(res, 400, msg);
});

// ---------- 启动 ----------
async function start() {
  try {
    // 先确认数据库可达，再启动 HTTP 服务，避免带病运行
    await checkDbConnection();
    console.log("✔ 数据库连接成功");

    app.listen(config.port, () => {
      console.log(`✔ 工单系统后端已启动: http://localhost:${config.port}`);
      console.log(`✔ 图片上传目录: ${config.upload.dir}`);
    });
  } catch (err) {
    console.error("✘ 数据库连接失败，请检查 .env 配置:", err);
    process.exit(1);
  }
}

// 进程优雅退出时释放连接池
process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

start();
