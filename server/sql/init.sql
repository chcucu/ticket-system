-- ============================================================
-- 通用工单系统 - 数据库初始化脚本
-- 目标数据库：MySQL 5.7+
-- 在 mysql 命令行执行：mysql -u root -p < sql/init.sql
-- 如需更换库名，同步修改 .env 中的 DB_NAME。
-- ============================================================

CREATE DATABASE IF NOT EXISTS ticket_system
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE ticket_system;

-- ------------------------------------------------------------
-- 工单表 tickets
-- ticket_id 为唯一编号（TICKET-YYYYMMDD-XXXX），故加 UNIQUE 约束
-- 该唯一约束同时是并发安全生成 ticket_id 时的最后兜底防线
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
  ticket_id VARCHAR(50) NOT NULL UNIQUE COMMENT '工单唯一编号 TICKET-YYYYMMDD-XXXX',
  username VARCHAR(100) NOT NULL DEFAULT '' COMMENT '提交人姓名',
  contact VARCHAR(200) NOT NULL DEFAULT '' COMMENT '联系方式 QQ/微信/电话/邮箱',
  content TEXT COMMENT '问题描述',
  images JSON NULL COMMENT '图片路径数组',
  status ENUM('pending','processing','replied') NOT NULL DEFAULT 'pending'
    COMMENT '工单状态：pending 待处理 / processing 处理中 / replied 已回复',
  email VARCHAR(200) NOT NULL DEFAULT '' COMMENT '用户邮箱，用于发送邮件',
  reply_content TEXT NULL COMMENT '管理员回复内容',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  KEY idx_status (status),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单表';

-- ------------------------------------------------------------
-- 工单序列计数表 ticket_sequence
-- 用于“按天重置”的并发安全自动编号：
--   以 date 为主键，seq 为当天已使用的最新序列号。
--   date 每天一行，配合事务 + SELECT ... FOR UPDATE 可以保证
--   同一时刻只有一条请求能拿到当天的递增序号，从而从根源避免并发冲突。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_sequence (
  biz_date DATE NOT NULL PRIMARY KEY COMMENT '业务日期（对应 ticket_id 中的 YYYYMMDD）',
  seq INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '当天已经分配到的最大序列号',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP COMMENT '最近分配时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单按天序列计数表';
