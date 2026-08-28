const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const GENDERS = ["male", "female", "unspecified"];

function sanitizeArray(value, maxItems) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string" && v.length > 0).slice(0, maxItems || 40);
}

router.put("/", requireAuth, async (req, res) => {
  const body = req.body || {};
  const name = String(body.name || "").trim().slice(0, 24);
  const gender = GENDERS.indexOf(body.gender) > -1 ? body.gender : "unspecified";
  const goal = sanitizeArray(body.goal, 4);
  const games = sanitizeArray(body.games, 40);
  const days = sanitizeArray(body.days, 7);
  const times = sanitizeArray(body.times, 4);
  const styles = sanitizeArray(body.styles, 4);
  const goodToKnow = String(body.goodToKnow || "").slice(0, 140);

  if (!name || games.length === 0 || days.length === 0 || times.length === 0) {
    return res.status(400).json({ error: "กรอกชื่อ และเลือกอย่างน้อย 1 เกม, 1 วัน, 1 ช่วงเวลา ก่อนนะ" });
  }

  try {
    await pool.query(
      `INSERT INTO profiles (user_id, name, gender, goal, games, days, times, styles, good_to_know, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (user_id) DO UPDATE SET
         name = $2, gender = $3, goal = $4, games = $5, days = $6, times = $7, styles = $8,
         good_to_know = $9, updated_at = now()`,
      [
        req.userId,
        name,
        gender,
        JSON.stringify(goal.length ? goal : ["friends"]),
        JSON.stringify(games),
        JSON.stringify(days),
        JSON.stringify(times),
        JSON.stringify(styles),
        goodToKnow
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "บันทึกโปรไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
});

module.exports = router;
