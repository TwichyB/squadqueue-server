const nodemailer = require("nodemailer");

let transporter = null;
let triedInit = false;

function getTransporter() {
  if (triedInit) return transporter;
  triedInit = true;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter;
}

function verificationEmailHtml(verifyUrl) {
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:8px;">' +
    '<h2 style="color:#171b24;">ยินดีต้อนรับสู่ SquadQueue!</h2>' +
    '<p style="color:#444;font-size:14px;line-height:1.6;">กดปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง</p>' +
    '<p style="margin:24px 0;">' +
    '<a href="' + verifyUrl + '" style="display:inline-block;background:#d85f22;color:#ffffff;padding:12px 26px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px;">ยืนยันอีเมล</a>' +
    "</p>" +
    '<p style="color:#888;font-size:12px;line-height:1.5;">ถ้ากดปุ่มไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์แทน:<br>' + verifyUrl + "</p>" +
    '<p style="color:#aaa;font-size:11px;margin-top:24px;">ถ้าคุณไม่ได้สมัครสมาชิก SquadQueue สามารถเพิกเฉยต่ออีเมลนี้ได้เลย</p>' +
    "</div>"
  );
}

async function sendVerificationEmail(toEmail, verifyUrl) {
  const t = getTransporter();
  if (!t) {
    console.log("[mailer] SMTP not configured — verification link for " + toEmail + ": " + verifyUrl);
    return;
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: "ยืนยันอีเมลของคุณ - SquadQueue",
    html: verificationEmailHtml(verifyUrl)
  });
}

module.exports = { sendVerificationEmail };
