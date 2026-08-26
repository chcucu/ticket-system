// ============================================================
// ticketId.ts - 工单编号生成（并发安全）
//
// 编号格式：TICKET-YYYYMMDD-XXXX（如 TICKET-20260826-0001）
// 生成策略：
//   1. 每天重新计数：使用 ticket_sequence 表，以 biz_date 为主键
//      记录“当天已分配到的最大序列号 seq”。
//   2. 在同一事务内先 SELECT ... FOR UPDATE 锁定当天这一行，再 seq+1，
//      从而串行化同一天的编号分配，从根源避免并发重复。
//   3. 若当天还不存在记录，则插入 seq=1，从 0001 开始。
//   4. 最外层再叠加悲观重试：即便在极端情况（如唯一覆盖写入失败）下，
//      也能通过 tickets.ticket_id 的 UNIQUE 约束 + 重试兜底。
// ============================================================
import { pool } from "../db";
import { todayDateStr } from "./dayUtil";

const MAX_RETRY = 5; // 并发兜底的最大重试次数
const MAX_SEQ = 9999; // 单日序列上限（超出报错，避免溢出）

/**
 * 主入口：生成一个当天唯一且并发安全的工单编号。
 */
export async function generateTicketId(): Promise<string> {
  // 极端并发下，若因唯一的时序问题导致编号冲突，整体重试
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      return await generateTicketIdOnce();
    } catch (err) {
      // 只有当发生“唯一键冲突”（节点 1062）时才视为可重试的并发冲突
      const code = (err as { code?: string | number })?.code;
      const isDuplicate =
        typeof code === "string" && (code === "ER_DUP_ENTRY" || /^1062/.test(code));
      if (!isDuplicate || attempt === MAX_RETRY) {
        throw err;
      }
      // 轻微退避后重试，降低再次冲突的概率
      await sleep(20 * attempt);
    }
  }
  throw new Error("工单编号生成失败：已达最大重试次数");
}

/**
 * 单次编号生成：事务 + SELECT ... FOR UPDATE 保证当天串行分配。
 */
async function generateTicketIdOnce(): Promise<string> {
  const dateStr = todayDateStr();
  const dateForSql = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. 尝试锁定当天的序列行（没有则下一步插入）
    const [rows] = await conn.execute(
      `SELECT seq FROM ticket_sequence WHERE biz_date = ? FOR UPDATE`,
      [dateForSql]
    ) as [Array<{ seq: number }>, unknown];

    let seq: number;
    if (rows.length > 0) {
      // 当天已有记录：序列号 +1
      seq = rows[0].seq + 1;
      await conn.execute(
        `UPDATE ticket_sequence SET seq = ? WHERE biz_date = ?`,
        [seq, dateForSql]
      );
    } else {
      // 当天首单：插入 seq=1
      seq = 1;
      await conn.execute(
        `INSERT INTO ticket_sequence (biz_date, seq) VALUES (?, ?)`,
        [dateForSql, seq]
      );
    }

    // 2. 单日序列有上限，超限直接报错（业务上也可改为滚动日期）
    if (seq > MAX_SEQ) {
      throw new Error("当日工单已达上限");
    }

    await conn.commit();

    // 3. 组装编号，并补足 4 位
    const padded = String(seq).padStart(4, "0");
    return `TICKET-${dateStr}-${padded}`;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
