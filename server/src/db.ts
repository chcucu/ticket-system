// ============================================================
// db.ts - 创建 MySQL 连接池
// 使用 mysql2/promise，所有查询返回 Promise，便于配合 async/await。
// 连接池统一管理连接，保证在高并发下的稳定性与性能。
// ============================================================
import mysql from "mysql2/promise";
import { config } from "./config";

// 创建连接池：连接池可以复用连接、限制最大连接数，避免频繁建连开销
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,   // 无空闲连接时排队等待
  connectionLimit: 10,        // 最大连接数
  queueLimit: 0,              // 排队不设上限
  charset: "utf8mb4",
  dateStrings: true,          // 时间字段以字符串返回，便于前端展示
  timezone: "+08:00",
});

/**
 * 测试数据库连接是否可用
 */
export async function checkDbConnection(): Promise<void> {
  await pool.query("SELECT 1");
}
