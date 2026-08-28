// Sends transactional email through the SMTP2GO HTTP API (https://smtp2go.com)
// instead of SMTP. We call the REST API directly with fetch rather than
// adding a client package, since Node 18+ (this project's minimum) has
// fetch built in and the only thing we need is one POST request.
//
// Why not SMTP/Gmail: Render's free web service plan blocks all outbound
// traffic to SMTP ports (25/465/587), so a direct connection to
// smtp.gmail.com times out no matter how correct the credentials are.
// SMTP2GO's API rides over plain HTTPS (443), which isn't blocked.
//
// Why SMTP2GO over Resend: Resend's free plan only delivers to the email
// address the Resend account itself was signed up with until you verify a
// domain you own. SMTP2GO's free plan lets you verify a single sender email
// address (no domain required — https://app.smtp2go.com/senders/) and once
// that's done it can send to ANY recipient, which is what a real signup flow
// needs. The tradeoff is deliverability: without domain-level SPF/DKIM
// alignment, mail is a little more likely to land in spam than with a fully
// verified domain — acceptable for now, worth revisiting if that becomes a
// real problem.
const SMTP2GO_API_URL = "https://api.smtp2go.com/v3/email/send";

function verificationEmailHtml(verifyUrl) {
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:8px;">' +
    '<h2 style="color:#171b24;">ยินดีต้อนรับสู่ SquadQueue!</h2>' +
    '<p style="color:#444;font-size:14px;line-height:1.6;">กดปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง</p>' +
    '<p style="margin:24px 0;">' +
    '<a href="' + verifyUrl + '" style="display:inline-block;background:#d85f22;color:#ffffff;padding:12px 26px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px;">ยืนยันอีเมล</a>' +
    "</p>" +
    '<p style="color:#888;font-size:12px;line-height:1.5;">ถ้ากดปุ่มไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์แทน:<br>' + verifyUrl + "</p>" +
    '<p style="color:#aaa;font-size:11px;margin-top:24px;">ถ้าคุณไม่ได้สมัครสมาชิก SquadQueue สามารถเพิกเฉยต่ออีเมลนี้ได้เลย</p>' +
    "</div>"
  );
}

async function sendVerificationEmail(toEmail, verifyUrl) {
  const apiKey = process.env.SMTP2GO_API_KEY;
  const sender = process.env.SMTP2GO_SENDER;
  if (!apiKey || !sender) {
    console.log("[mailer] SMTP2GO not configured — verification link for " + toEmail + ": " + verifyUrl);
    return;
  }

  const res = await fetch(SMTP2GO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Smtp2go-Api-Key": apiKey,
      Accept: "application/json"
    },
    body: JSON.stringify({
      sender: sender,
      to: [toEmail],
      subject: "ยืนยันอีเมลของคุณ - SquadQueue",
      html_body: verificationEmailHtml(verifyUrl)
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(function () {
      return "";
    });
    throw new Error("SMTP2GO API error " + res.status + ": " + body);
  }
}

module.exports = { sendVerificationEmail };
