const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      "INSERT INTO users (email, password_hash, provider) VALUES ($1, $2, 'local') RETURNING id, email",
      [email, hash]
    );
    const user = result.rows[0];
    setAuthCookie(res, signToken(user.id));
    res.json({ user });
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
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

    setAuthCookie(res, signToken(user.id));
    res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง" });
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
          goodToKnow: row.good_to_know
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
  const insertResult = await pool.query(
    "INSERT INTO users (email, provider, provider_id) VALUES ($1, $2, $3) RETURNING id, email",
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

// ---- Facebook OAuth ----
// Setup: https://developers.facebook.com/ -> your app -> add "Facebook Login" product.
// Add FACEBOOK_REDIRECT_URI under Valid OAuth Redirect URIs, then fill the client id/secret in .env.
// Note: while the Facebook app is in "development" mode, only accounts added as testers can log in.

router.get("/facebook", (req, res) => {
  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.redirect("/?loginError=" + encodeURIComponent("ยังไม่ได้ตั้งค่า Facebook OAuth บนเซิร์ฟเวอร์นี้"));
  }
  const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "email public_profile");
  res.redirect(url.toString());
});

router.get("/facebook/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) throw new Error("missing code");

    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", process.env.FACEBOOK_CLIENT_ID);
    tokenUrl.searchParams.set("client_secret", process.env.FACEBOOK_CLIENT_SECRET);
    tokenUrl.searchParams.set("redirect_uri", process.env.FACEBOOK_REDIRECT_URI);
    tokenUrl.searchParams.set("code", String(code));
    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("Facebook token exchange failed");

    const profileUrl = new URL("https://graph.facebook.com/me");
    profileUrl.searchParams.set("fields", "id,name,email");
    profileUrl.searchParams.set("access_token", tokenData.access_token);
    const profileRes = await fetch(profileUrl.toString());
    const fbUser = await profileRes.json();

    const email = fbUser.email ? String(fbUser.email).toLowerCase() : null;
    const user = await findOrCreateOAuthUser("facebook", fbUser.id, email);
    setAuthCookie(res, signToken(user.id));
    res.redirect("/?login=facebook");
  } catch (err) {
    console.error(err);
    res.redirect("/?loginError=" + encodeURIComponent("เข้าสู่ระบบด้วย Facebook ไม่สำเร็จ"));
  }
});

module.exports = router;
