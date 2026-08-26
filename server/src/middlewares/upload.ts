// ============================================================
// upload.ts - 基于 multer 的图片上传中间件
// 规则：
//   - 图片保存到上传目录（默认 ./uploads）
//   - 单张大小 ≤ 2MB，总数 ≤ 9 张
//   - 类型仅限 image/jpeg、image/png
//   - 文件名使用随机串 + 时间戳，避免重名覆盖
// ============================================================
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { config } from "../config";
import type { Request } from "express";

// 确保上传目录存在（不存在则递归创建）
if (!fs.existsSync(config.upload.dir)) {
  fs.mkdirSync(config.upload.dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.upload.dir),
  filename: (_req, file, cb) => {
    // 随机文件名：时间戳 + 随机hex。保留源扩展名
    const ext = path.extname(file.originalname) || ".jpg";
    const name = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, name);
  },
});

// 文件类型过滤器：仅允许 JPEG / PNG
function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("仅支持 JPG / PNG 格式的图片"));
  }
}

const MAX_BYTES = config.upload.maxSizeMb * 1024 * 1024; // 单张大小上限

export const uploadLimit = MAX_BYTES;

export const uploadImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_BYTES,           // 单张 ≤ MAX_SIZE_MB
    files: config.upload.maxCount, // 总数 ≤ MAX_COUNT
  },
});
