const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { onlineUserIds } = require("../socket");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, p.name, p.gender, p.goal, p.games, p.days, p.times, p.styles, p.genres, p.good_to_know,
              p.reputation, rv.value AS my_vote
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN reputation_votes rv ON rv.target_id = p.user_id AND rv.voter_id = $1
       WHERE p.user_id != $1
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = p.user_id)
              OR (b.blocked_id = $1 AND b.blocker_id = p.user_id)
         )
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
      genres: row.genres,
      goodToKnow: row.good_to_know,
      reputation: row.reputation,
      myVote: row.my_vote || 0,
      online: onlineUserIds.has(row.id)
    }));

    res.json({ candidates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดรายชื่อไม่สำเร็จ" });
  }
});

module.exports = router;
