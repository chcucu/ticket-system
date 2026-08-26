// ============================================================
// auth.ts - 管理员鉴权中间件
// 从请求头 Authorization: Bearer <token> 中解析 JWT，
// 校验通过则放行；否则返回 401 统一错误结构。
// ============================================================
import type { Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../utils/jwt";

// 扩展 Express Request 类型，注入管理员信息（可选）
declare global {
  namespace Express {
    interface Request {
      admin?: { role: "admin" };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";

  // 解析 "Bearer <token>"
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "未登录或缺少访问令牌，请先登录",
      code: 401,
    });
  }

  try {
    const payload = verifyAdminToken(token);
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "登录状态已失效，请重新登录",
      code: 401,
    });
  }
}
