const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// List of people the current user has blocked (for the "manage blocked
// users" screen). Registered before the "/:id/..." routes below so a literal
// path of "/blocked" is never swallowed by ":id".
router.get("/blocked", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.blocked_id AS id, p.name
       FROM blocks b
       LEFT JOIN profiles p ON p.user_id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC`,
      [req.userId]
    );
    res.json({
      blocked: result.rows.map((row) => ({ id: row.id, name: row.name || "(บัญชีนี้ไม่มีโปรไฟล์แล้ว)" }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดรายชื่อที่บล็อกไม่สำเร็จ" });
  }
});

router.post("/:id/block", requireAuth, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isInteger(targetId)) return res.status(400).json({ error: "รหัสผู้ใช้ไม่ถูกต้อง" });
  if (targetId === req.userId) return res.status(400).json({ error: "บล็อกตัวเองไม่ได้" });

  try {
    await pool.query(
      "INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.userId, targetId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "บล็อกไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
});

router.post("/:id/unblock", requireAuth, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isInteger(targetId)) return res.status(400).json({ error: "รหัสผู้ใช้ไม่ถูกต้อง" });

  try {
    // Only ever deletes a row this user created (blocker_id = req.userId),
    // so you can't accidentally lift someone else's block on you.
    await pool.query("DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2", [req.userId, targetId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เลิกบล็อกไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
});

module.exports = router;
