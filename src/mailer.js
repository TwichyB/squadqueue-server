// Sends transactional email through the Brevo HTTP API (https://www.brevo.com)
// instead of SMTP. We call the REST API directly with fetch rather than
// adding a client package, since Node 18+ (this project's minimum) has
// fetch built in and the only thing we need is one POST request.
//
// Why not SMTP/Gmail: Render's free web service plan blocks all outbound
// traffic to SMTP ports (25/465/587), so a direct connection to
// smtp.gmail.com times out no matter how correct the credentials are.
// Brevo's API rides over plain HTTPS (443), which isn't blocked.
//
// Why Brevo (instead of Resend or SMTP2GO, which we tried first):
//   - Resend's free plan only delivers to the email address the Resend
//     account itself was signed up with until you verify a domain you own.
//   - SMTP2GO requires the *account signup* email itself to be on a private/
//     business domain — it rejects gmail.com/yahoo.com addresses outright,
//     which blocks signing up at all until you already have a domain email.
//   - Brevo has neither restriction: you can sign up with any email, and a
//     verified single sender (or, better, a verified domain — see
//     .env.example) can send to any recipient on the free plan (300/day).
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

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
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "SquadQueue";
  if (!apiKey || !senderEmail) {
    console.log("[mailer] Brevo not configured — verification link for " + toEmail + ": " + verifyUrl);
    return;
  }

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      Accept: "application/json"
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail }],
      subject: "ยืนยันอีเมลของคุณ - SquadQueue",
      htmlContent: verificationEmailHtml(verifyUrl)
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(function () {
      return "";
    });
    throw new Error("Brevo API error " + res.status + ": " + body);
  }
}

module.exports = { sendVerificationEmail };
