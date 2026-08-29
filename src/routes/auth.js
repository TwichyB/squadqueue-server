const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../mailer");

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_TOKEN_TTL_MS = 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function signToken(userId) {
  return jwt.sign({ uid: userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

function getBaseUrl(req) {
  const envUrl = process.env.APP_BASE_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  return proto + "://" + req.get("host");
}

async function issueVerificationToken(userId, email, req) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
  await pool.query(
    "UPDATE users SET verification_token = $1, verification_token_expires_at = $2 WHERE id = $3",
    [token, expiresAt, userId]
  );
  const verifyUrl = getBaseUrl(req) + "/api/auth/verify-email?token=" + token;
  try {
    await sendVerificationEmail(email, verifyUrl);
  } catch (err) {
    console.error("Failed to send verification email:", err);
  }
}

// ---- Email + password ----

router.post("/signup", async (req, res) => {
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  const password = String((req.body && req.body.password) || "");

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "กรอกอีเมลให้ถูกต้อง" });
  if (password.length < 6) return res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length) {
      return res.status(409).json({ error: "มีบัญชีนี้อยู่แล้ว ลองเข้าสู่ระบบแทน" });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, provider, email_verified) VALUES ($1, $2, 'local', false) RETURNING id, email",
      [email, hash]
    );
    const user = result.rows[0];
    await issueVerificationToken(user.id, user.email, req);
    // No auth cookie yet — the account can't log in until the email is verified.
    res.json({
      ok: true,
      requiresVerification: true,
      message: "ส่งอีเมลยืนยันไปที่ " + user.email + " แล้ว กรุณาตรวจสอบกล่องจดหมายก่อนเข้าสู่ระบบ"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "สมัครสมาชิกไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
});

router.post("/login", async (req, res) => {
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  const password = String((req.body && req.body.password) || "");

  try {
    const result = await pool.query(
      "SELECT id, email, password_hash, email_verified FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

    if (!user.email_verified) {
      return res.status(403).json({
        error: "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ เช็คกล่องจดหมายของคุณ",
        needsVerification: true,
        email: user.email
      });
    }

    setAuthCookie(res, signToken(user.id));
    res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
});

router.get("/verify-email", async (req, res) => {
  const token = req.query.token;
  if (!token || typeof token !== "string") {
    return res.redirect("/?verifyError=" + encodeURIComponent("ลิงก์ยืนยันไม่ถูกต้อง"));
  }
  try {
    const result = await pool.query(
      "SELECT id, verification_token_expires_at FROM users WHERE verification_token = $1",
      [token]
    );
    const user = result.rows[0];
    if (!user) {
      return res.redirect("/?verifyError=" + encodeURIComponent("ลิงก์ยืนยันไม่ถูกต้องหรือถูกใช้ไปแล้ว"));
    }
    if (user.verification_token_expires_at && new Date(user.verification_token_expires_at) < new Date()) {
      return res.redirect("/?verifyError=" + encodeURIComponent("ลิงก์ยืนยันหมดอายุแล้ว กรุณาขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ"));
    }
    await pool.query(
      "UPDATE users SET email_verified = true, verification_token = NULL, verification_token_expires_at = NULL WHERE id = $1",
      [user.id]
    );
    setAuthCookie(res, signToken(user.id));
    res.redirect("/?verified=1");
  } catch (err) {
    console.error(err);
    res.redirect("/?verifyError=" + encodeURIComponent("ยืนยันอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง"));
  }
});

router.post("/resend-verification", async (req, res) => {
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "กรอกอีเมลให้ถูกต้อง" });

  try {
    const result = await pool.query(
      "SELECT id, email, email_verified FROM users WHERE email = $1 AND provider = 'local'",
      [email]
    );
    const user = result.rows[0];
    // Always send back the exact same message whether or not the account
    // exists / is already verified, so this endpoint can't be used to probe
    // which emails are registered (a different message per branch would leak
    // that information even with the same status code and JSON shape).
    const genericMessage = "ถ้าอีเมลนี้อยู่ในระบบและยังไม่ยืนยัน จะส่งลิงก์ใหม่ไปให้แล้ว";
    if (user && !user.email_verified) {
      await issueVerificationToken(user.id, user.email, req);
    }
    res.json({ ok: true, message: genericMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "กรอกอีเมลให้ถูกต้อง" });

  // Same enumeration-safety approach as /resend-verification: always return
  // the identical generic message whether or not the account exists, so this
  // endpoint can't be used to check which emails have accounts here.
  const genericMessage = "ถ้าอีเมลนี้อยู่ในระบบ จะส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว";

  try {
    const result = await pool.query(
      "SELECT id, email FROM users WHERE email = $1 AND provider = 'local'",
      [email]
    );
    const user = result.rows[0];
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await pool.query(
        "UPDATE users SET reset_token = $1, reset_token_expires_at = $2 WHERE id = $3",
        [token, expiresAt, user.id]
      );
      const resetUrl = getBaseUrl(req) + "/?resetToken=" + token;
      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (err) {
        console.error("Failed to send password reset email:", err);
      }
    }
    res.json({ ok: true, message: genericMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
});

router.post("/reset-password", async (req, res) => {
  const token = String((req.body && req.body.token) || "");
  const password = String((req.body && req.body.password) || "");

  if (!token) return res.status(400).json({ error: "ลิงก์ตั้งรหัสผ่านใหม่ไม่ถูกต้อง" });
  if (password.length < 6) return res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });

  try {
    const result = await pool.query(
      "SELECT id, reset_token_expires_at FROM users WHERE reset_token = $1",
      [token]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(400).json({ error: "ลิงก์ตั้งรหัสผ่านใหม่ไม่ถูกต้องหรือถูกใช้ไปแล้ว" });
    }
    if (user.reset_token_expires_at && new Date(user.reset_token_expires_at) < new Date()) {
      return res.status(400).json({ error: "ลิงก์ตั้งรหัสผ่านใหม่หมดอายุแล้ว กรุณาขอลิงก์ใหม่" });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      // Resetting the password also proves the person controls this inbox,
      // same as clicking the email-verification link — so mark it verified
      // too, in case this account somehow reached this point unverified.
      "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL, email_verified = true WHERE id = $2",
      [hash, user.id]
    );

    setAuthCookie(res, signToken(user.id));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ตั้งรหัสผ่านใหม่ไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const userResult = await pool.query("SELECT id, email FROM users WHERE id = $1", [req.userId]);
    const user = userResult.rows[0];
    if (!user) return res.status(401).json({ error: "ไม่พบบัญชีผู้ใช้" });

    const profileResult = await pool.query("SELECT * FROM profiles WHERE user_id = $1", [req.userId]);
    const row = profileResult.rows[0];
    const profile = row
      ? {
          name: row.name,
          gender: row.gender,
          goal: row.goal,
          games: row.games,
          days: row.days,
          times: row.times,
          styles: row.styles,
          genres: row.genres,
          goodToKnow: row.good_to_know,
          reputation: row.reputation,
          minMatchPct: row.min_match_pct,
          interestedIn: row.interested_in
        }
      : null;

    res.json({ user, profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดข้อมูลไม่สำเร็จ" });
  }
});

// ---- Shared helper for OAuth providers ----

async function findOrCreateOAuthUser(provider, providerId, email) {
  let result = await pool.query(
    "SELECT id, email FROM users WHERE provider = $1 AND provider_id = $2",
    [provider, providerId]
  );
  if (result.rows.length) return result.rows[0];

  if (email) {
    result = await pool.query("SELECT id, email FROM users WHERE email = $1", [email]);
    if (result.rows.length) return result.rows[0];
  }

  const finalEmail = email || provider + "_" + providerId + "@oauth.local";
  // OAuth providers have already verified the account owns the email (when they returned one),
  // so these accounts skip our own email-verification gate.
  const insertResult = await pool.query(
    "INSERT INTO users (email, provider, provider_id, email_verified) VALUES ($1, $2, $3, true) RETURNING id, email",
    [finalEmail, provider, providerId]
  );
  return insertResult.rows[0];
}

// ---- Discord OAuth ----
// Setup: https://discord.com/developers/applications -> your app -> OAuth2 tab.
// Add DISCORD_REDIRECT_URI there exactly, then fill DISCORD_CLIENT_ID/SECRET in .env.

router.get("/discord", (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.redirect("/?loginError=" + encodeURIComponent("ยังไม่ได้ตั้งค่า Discord OAuth บนเซิร์ฟเวอร์นี้"));
  }
  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify email");
  res.redirect(url.toString());
});

router.get("/discord/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) throw new Error("missing code");

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("Discord token exchange failed");

    const profileRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: "Bearer " + tokenData.access_token }
    });
    const discordUser = await profileRes.json();

    const email = discordUser.email ? String(discordUser.email).toLowerCase() : null;
    const user = await findOrCreateOAuthUser("discord", discordUser.id, email);
    setAuthCookie(res, signToken(user.id));
    res.redirect("/?login=discord");
  } catch (err) {
    console.error(err);
    res.redirect("/?loginError=" + encodeURIComponent("เข้าสู่ระบบด้วย Discord ไม่สำเร็จ"));
  }
});

module.exports = router;
