// ============================================================
// mailer.ts - 基于 nodemailer 的邮件发送
//
// SMTP 配置来自环境变量：MAIL_HOST / MAIL_USER / MAIL_PASS / MAIL_FROM
// 实现两个功能：
//   1. sendSubmitSuccessMail：工单提交成功后，向用户邮箱发送含工单编号的成功邮件。
//   2. sendReplyMail：管理员回复工单后，向用户发送回复通知（接口预留，已接通）。
//
// 说明：邮件发送失败不影响主流程（提交/回复依然成功），仅打印日志。
// ============================================================
import nodemailer from "nodemailer";
import { config } from "../config";

// 发件人：若未配置 MAIL_FROM，则用品牌名兜底
const MAIL_FROM = config.mail.from || `${config.brand.name} <noreply@example.com>`;
const BRAND = config.brand.name; // 品牌名（开源可自定义）
const TEAM = config.brand.team;

// 创建可复用的 transporter（复用连接提升性能）
const transporter = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.secure,
  auth: {
    user: config.mail.user,
    pass: config.mail.pass,
  },
  // 部分服务商需要 TLS 兼容设置
  tls: {
    rejectUnauthorized: false,
  },
});

/** 底层发送方法：统一失败处理并打印日志（不抛出） */
async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    if (!config.mail.host || !config.mail.user) {
      console.warn("[mail] 未配置 MAIL_HOST/MAIL_USER，跳过发送：", subject);
      return false;
    }
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      html,
    });
    console.log(`[mail] 已发送: ${subject} -> ${to} (msgId=${info.messageId})`);
    return true;
  } catch (err) {
    console.error("[mail] 发送失败:", err);
    return false;
  }
}

/**
 * 工单提交成功通知：向用户邮件发送“已提交，工单编号 xxx”。
 */
export async function sendSubmitSuccessMail(to: string, ticketId: string) {
  const html = `
    <div style="font-family:-apple-system,'PingFang SC',sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden;">
      <div style="background:#67c23a;color:#fff;padding:18px 24px;font-size:18px;font-weight:bold;">
        ✔ ${BRAND} · 反馈提交成功
      </div>
      <div style="padding:24px;">
        <p style="color:#333;font-size:15px;">你好，感谢你的反馈，我们已经成功收到并登记。</p>
        <p style="color:#333;font-size:15px;">你的工单编号：</p>
        <p style="font-size:24px;font-weight:bold;color:#67c23a;letter-spacing:1px;margin:12px 0;">${ticketId}</p>
        <p style="font-size:13px;color:#888;">请妥善保管该编号，后续沟通时便于快速定位你的工单。</p>
        <p style="font-size:13px;color:#999;margin-top:24px;">—— ${BRAND} ${TEAM}</p>
      </div>
    </div>
  `;
  return sendMail(to, `【${BRAND}】工单提交成功 - ${ticketId}`, html);
}

/**
 * 管理员回复通知：向用户邮件发送回复内容。
 */
export async function sendReplyMail(to: string, ticketId: string, replyContent: string) {
  const html = `
    <div style="font-family:-apple-system,'PingFang SC',sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden;">
      <div style="background:#67c23a;color:#fff;padding:18px 24px;font-size:18px;font-weight:bold;">
        💬 ${BRAND} · 工单回复通知
      </div>
      <div style="padding:24px;">
        <p style="color:#333;font-size:15px;">你的工单 <span style="font-weight:bold;">${ticketId}</span> 已得到回复：</p>
        <div style="background:#f7f8fa;border-radius:8px;padding:14px 18px;color:#444;font-size:15px;line-height:1.8;margin-top:10px;">
          ${replyContent.replace(/\n/g, "<br/>")}
        </div>
        <p style="font-size:13px;color:#999;margin-top:20px;">如有其他问题，欢迎再次反馈。</p>
        <p style="font-size:13px;color:#999;">—— ${BRAND} ${TEAM}</p>
      </div>
    </div>
  `;
  return sendMail(to, `【${BRAND}】工单回复通知 - ${ticketId}`, html);
}
