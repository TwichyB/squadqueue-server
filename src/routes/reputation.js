const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Cast, change, or retract a reputation vote on another user.
// One row per (voter, target) pair in reputation_votes caps each voter to a
// single active vote per target at the database level. Clicking the same
// thumb you already picked retracts the vote; clicking the other thumb
// swings it straight from +1 to -1 (or back) in one request.
router.post("/:id/vote", requireAuth, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const value = req.body && req.body.value;

  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: "รหัสผู้ใช้ไม่ถูกต้อง" });
  }
  if (value !== 1 && value !== -1) {
    return res.status(400).json({ error: "ค่าโหวตต้องเป็น 1 หรือ -1 เท่านั้น" });
  }
  if (targetId === req.userId) {
    return res.status(400).json({ error: "โหวตให้ตัวเองไม่ได้" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT value FROM reputation_votes WHERE voter_id = $1 AND target_id = $2 FOR UPDATE",
      [req.userId, targetId]
    );

    let delta = 0;
    let myVote = value;

    if (existing.rows.length === 0) {
      await client.query(
        "INSERT INTO reputation_votes (voter_id, target_id, value) VALUES ($1, $2, $3)",
        [req.userId, targetId, value]
      );
      delta = value;
    } else if (existing.rows[0].value === value) {
      // Re-clicking the thumb you already pressed retracts the vote entirely.
      await client.query(
        "DELETE FROM reputation_votes WHERE voter_id = $1 AND target_id = $2",
        [req.userId, targetId]
      );
      delta = -value;
      myVote = 0;
    } else {
      await client.query(
        "UPDATE reputation_votes SET value = $3, updated_at = now() WHERE voter_id = $1 AND target_id = $2",
        [req.userId, targetId, value]
      );
      delta = value - existing.rows[0].value; // e.g. -1 -> +1 moves the score by 2
    }

    const updated = await client.query(
      "UPDATE profiles SET reputation = reputation + $2 WHERE user_id = $1 RETURNING reputation",
      [targetId, delta]
    );

    if (updated.rows.length === 0) {
      throw new Error("Target user has no profile to vote on");
    }

    await client.query("COMMIT");
    res.json({ ok: true, reputation: updated.rows[0].reputation, myVote: myVote });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "โหวตไม่สำเร็จ ลองใหม่อีกครั้ง" });
  } finally {
    client.release();
  }
});

module.exports = router;
