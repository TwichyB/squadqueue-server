const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/:otherId/messages", requireAuth, async (req, res) => {
  const otherId = parseInt(req.params.otherId, 10);
  if (!Number.isInteger(otherId)) return res.status(400).json({ error: "invalid id" });

  try {
    const blockCheck = await pool.query(
      `SELECT 1 FROM blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [req.userId, otherId]
    );
    if (blockCheck.rows.length > 0) {
      return res.json({ messages: [] });
    }

    const result = await pool.query(
      `SELECT id, sender_id, receiver_id, content, created_at FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC
       LIMIT 300`,
      [req.userId, otherId]
    );

    res.json({
      messages: result.rows.map((r) => ({
        id: r.id,
        from: r.sender_id === req.userId ? "me" : "them",
        senderId: r.sender_id,
        receiverId: r.receiver_id,
        text: r.content,
        ts: r.created_at
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดข้อความไม่สำเร็จ" });
  }
});

module.exports = router;
