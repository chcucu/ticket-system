// ============================================================
// jwt.ts - 管理员 JWT 签发与校验
// 简单实现：签发一个固定角色为 admin 的令牌即可。
// ============================================================
import jwt from "jsonwebtoken";
import { config } from "../config";

/**
 * 签发管理员令牌
 * 载荷：{ role: 'admin', iat, exp }
 */
export function signAdminToken(): string {
  const payload = { role: "admin" as const };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions["expiresIn"],
  });
}

/**
 * 校验管理员令牌
 * 校验失败会抛出异常，由调用方捕获。
 */
export function verifyAdminToken(token: string): { role: "admin" } {
  return jwt.verify(token, config.jwt.secret) as { role: "admin" };
}
