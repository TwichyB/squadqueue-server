const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { onlineUserIds } = require("../socket");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, p.name, p.gender, p.goal, p.games, p.days, p.times, p.styles, p.good_to_know
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id != $1
       ORDER BY p.updated_at DESC
       LIMIT 200`,
      [req.userId]
    );

    const candidates = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      gender: row.gender,
      goal: row.goal,
      games: row.games,
      days: row.days,
      times: row.times,
      styles: row.styles,
      goodToKnow: row.good_to_know,
      online: onlineUserIds.has(row.id)
    }));

    res.json({ candidates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดรายชื่อไม่สำเร็จ" });
  }
});

module.exports = router;
