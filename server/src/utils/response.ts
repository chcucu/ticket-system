// ============================================================
// response.ts - 统一响应格式
// 所有接口成功/失败都返回固定结构，便于前端统一处理。
// ============================================================
import type { Response } from "express";

/** 成功响应：{ success:true, data, message } */
export function ok<T>(res: Response, data: T, message = "success") {
  return res.json({ success: true, data, message });
}

/** 失败响应：{ success:false, message, code } */
export function fail(res: Response, code = 400, message = "请求失败") {
  return res.status(code).json({ success: false, message, code });
}
