// ============================================================
// routes/ticket.ts - 工单相关接口
//
//   POST /api/ticket/submit   提交工单（multipart/form-data，无需鉴权）
//   GET  /api/ticket/list     分页列表（需 Bearer Token）
//   POST /api/ticket/reply    管理员回复（需 Bearer Token）
// ============================================================
import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import type mysql from "mysql2/promise";
import { pool } from "../db";
import { config } from "../config";
import { uploadImages } from "../middlewares/upload";
import { requireAuth } from "../middlewares/auth";
import { generateTicketId } from "../utils/ticketId";
import { sendSubmitSuccessMail, sendReplyMail } from "../utils/mailer";
import { ok, fail } from "../utils/response";

const router = Router();

// ------------------------------------------------------------------
// 通用 multer 异步包装：把 multer 的 callback 错误转成 Promise.reject，
// 便于用 try-catch 统一处理（包括文件体积/类型超限等错误）。
// ------------------------------------------------------------------
function useUpload(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadImages.array(fieldName, config.upload.maxCount)(req, res, (err: unknown) => {
      if (err) return next(err);
      next();
    });
  };
}

// ------------------------------------------------------------------
// 清理已上传但未能成功写入数据库的临时图片（失败时避免残留文件）
// ------------------------------------------------------------------
function cleanupFiles(files: Express.Multer.File[] | undefined) {
  if (!files) return;
  for (const f of files) {
    fs.unlink(f.path, () => {}); // 失败忽略（文件可能不存在）
  }
}

// 表单字段必填校验
// 说明：邮箱作为“用于接收处理结果”的选填字段，若不填则不发送邮件；
// 若填写则必须为合法邮箱格式。
function validateSubmitBody(body: Record<string, unknown>): string | null {
  const { username, contact, content, email } = body;
  if (!username || !String(username).trim()) return "姓名不能为空";
  if (!contact || !String(contact).trim()) return "联系方式不能为空";
  if (!content || !String(content).trim()) return "问题描述不能为空";

  // 邮箱为选填；若填写则校验格式
  if (email && String(email).trim()) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(String(email))) return "邮箱格式不正确";
  }

  return null;
}

// ------------------------------------------------------------------
// 1. POST /api/ticket/submit
//    接收 multipart/form-data：username, contact, content, email, images[]
//    生成 ticket_id → 入库 → 发送提交成功邮件
// ------------------------------------------------------------------
router.post("/submit", useUpload("images"), async (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    // 1. 表单校验
    const validateMsg = validateSubmitBody(body);
    if (validateMsg) {
      cleanupFiles(files);
      return fail(res, 400, validateMsg);
    }

    // 2. 生成当天递增的唯一工单编号（并发安全，详见 utils/ticketId.ts）
    const ticketId = await generateTicketId();

    // 3. 提取相对路径（前端/管理端通过 /uploads/xxx 访问）
    const imagePaths = files.map((f) => `/uploads/${f.path.split("/").pop()}`);

    // 邮箱为选填，空则不发送相关邮件
    const email = String(body.email ?? "").trim();

    // 4. 写入数据库（ticket_id 有 UNIQUE 约束，极端并发下由
    //    generateTicketId 内部重试兜底，此处直接入库）
    await pool.execute(
      `INSERT INTO tickets (ticket_id, username, contact, content, images, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        ticketId,
        String(body.username).trim(),
        String(body.contact).trim(),
        String(body.content).trim(),
        JSON.stringify(imagePaths),
        email,
      ]
    );

    // 5. 发送“提交成功”邮件（含工单编号）。仅当用户填写邮箱时发送；
    //    失败只记日志不影响主流程
    if (email) {
      await sendSubmitSuccessMail(email, ticketId);
    }

    return ok(res, { ticket_id: ticketId }, "提交成功");
  } catch (err) {
    console.error("[ticket/submit] 提交工单异常:", err);
    // 入库失败时清理已落盘的图片，避免脏数据
    cleanupFiles(files);
    return fail(res, 500, "服务器内部错误，请稍后重试");
  }
});

// ------------------------------------------------------------------
// 2. GET /api/ticket/list?page=1&size=10
//    需 Bearer Token 鉴权。分页查询，按创建时间降序。
// ------------------------------------------------------------------
router.get("/list", requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const size = Math.min(50, Math.max(1, parseInt(String(req.query.size ?? "10"), 10) || 10));
    const offset = (page - 1) * size;

    // 查询总数（返回分页元数据）
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM tickets`
    ) as [Array<{ total: number }>, unknown];
    const total = Number(countRows[0].total);

    // 分页查询，按创建时间降序
    const [rows] = await pool.execute(
      `SELECT id, ticket_id, username, contact, content, images, status,
              email, reply_content, created_at, updated_at
       FROM tickets
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [size, offset]
    ) as [Array<Record<string, unknown>>, unknown];

    // 把 images JSON 字段解析回数组返回给前端
    const list = (rows as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      images: parseImages(row.images),
    }));

    return ok(res, {
      list,
      pagination: { page, size, total, totalPages: Math.ceil(total / size) || 0 },
    });
  } catch (err) {
    console.error("[ticket/list] 查询工单异常:", err);
    return fail(res, 500, "服务器内部错误");
  }
});

// ------------------------------------------------------------------
// 3. POST /api/ticket/reply
//    需 Bearer Token 鉴权。
//    接收 { ticket_id, reply_content }
//    将工单状态置为 replied，并向用户邮箱发送回复通知。
// ------------------------------------------------------------------
router.post("/reply", requireAuth, async (req, res) => {
  try {
    const { ticket_id, reply_content } = (req.body ?? {}) as {
      ticket_id?: unknown;
      reply_content?: unknown;
    };

    if (!ticket_id || !String(ticket_id).trim()) {
      return fail(res, 400, "工单编号不能为空");
    }
    if (!reply_content || !String(reply_content).trim()) {
      return fail(res, 400, "回复内容不能为空");
    }

    // 更新状态为 replied，并保存回复内容
    const [result] = await pool.execute(
      `UPDATE tickets
       SET status = 'replied', reply_content = ?
       WHERE ticket_id = ?`,
      [String(reply_content).trim(), String(ticket_id).trim()]
    ) as [mysql.ResultSetHeader, unknown];

    if (result.affectedRows === 0) {
      return fail(res, 404, "工单不存在或编号有误");
    }

    // 读取该工单的邮箱，用于发送回复通知
    const [rows] = await pool.execute(
      `SELECT email FROM tickets WHERE ticket_id = ? LIMIT 1`,
      [String(ticket_id).trim()]
    ) as [Array<{ email: string }>, unknown];

    // 管理员回复后向用户发送回复通知邮件（失败仅记日志，不影响接口返回）
    if (rows.length > 0 && rows[0].email) {
      await sendReplyMail(rows[0].email, String(ticket_id).trim(), String(reply_content).trim());
    }

    return ok(res, { ticket_id: String(ticket_id).trim() }, "回复成功");
  } catch (err) {
    console.error("[ticket/reply] 回复工单异常:", err);
    return fail(res, 500, "服务器内部错误");
  }
});

/** 解析 images JSON 字段，容错处理非法值 */
function parseImages(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default router;
