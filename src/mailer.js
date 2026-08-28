// Sends transactional email through the Resend HTTP API (https://resend.com)
// instead of SMTP. We call the REST API directly with fetch rather than
// adding the "resend" npm package, since Node 18+ (this project's minimum)
// has fetch built in and the only thing we need is one POST request.
//
// Why not SMTP/Gmail: Render's free web service plan blocks all outbound
// traffic to SMTP ports (25/465/587), so a direct connection to
// smtp.gmail.com times out no matter how correct the credentials are.
// Resend's API rides over plain HTTPS (443), which isn't blocked.
//
// Note: without a verified sending domain on Resend, the account can only
// deliver to the email address the Resend account itself was signed up
// with — sending to any other address returns a 403 from Resend's API.
// That's a Resend-side restriction, not a bug here; verifying a domain at
// https://resend.com/domains lifts it for real end users.
const RESEND_API_URL = "https://api.resend.com/emails";

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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("[mailer] RESEND_API_KEY not configured — verification link for " + toEmail + ": " + verifyUrl);
    return;
  }

  const from = process.env.RESEND_FROM || "SquadQueue <onboarding@resend.dev>";

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: from,
      to: [toEmail],
      subject: "ยืนยันอีเมลของคุณ - SquadQueue",
      html: verificationEmailHtml(verifyUrl)
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(function () {
      return "";
    });
    throw new Error("Resend API error " + res.status + ": " + body);
  }
}

module.exports = { sendVerificationEmail };
