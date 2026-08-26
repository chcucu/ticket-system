// ============================================================
// routes/auth.ts - 管理员登录
// POST /api/auth/login  { password }
// ============================================================
import { Router } from "express";
import { ok, fail } from "../utils/response";
import { signAdminToken } from "../utils/jwt";
import { config } from "../config";

const router = Router();

/**
 * POST /api/auth/login
 * 使用硬编码在环境变量 ADMIN_PASSWORD 中的管理员密码进行校验，
 * 校验通过后签发 JWT 令牌。
 */
router.post("/login", (req, res) => {
  try {
    const { password } = req.body ?? {};

    if (typeof password !== "string" || password.length === 0) {
      return fail(res, 400, "密码不能为空");
    }

    // 与管理员密码对比
    if (password !== config.adminPassword) {
      return fail(res, 401, "密码错误，请重试");
    }

    const token = signAdminToken();
    return ok(res, { token, expires_in: config.jwt.expiresIn }, "登录成功");
  } catch (err) {
    console.error("[auth] 登录异常:", err);
    return fail(res, 500, "服务器内部错误");
  }
});

export default router;
