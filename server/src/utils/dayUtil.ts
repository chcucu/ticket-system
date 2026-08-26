// ============================================================
// dayUtil.ts - 日期工具
// ============================================================

/**
 * 生成 YYYYMMDD 形式的日期字符串（例如 20260826）
 * 使用本地时间，保证与业务日期一致。
 */
export function todayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
