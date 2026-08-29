const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { onlineUserIds } = require("../socket");

const router = express.Router();

// รายชื่อคนที่เคยคุยด้วยกันแล้ว เรียงจากคุยล่าสุด พร้อมข้อความล่าสุดที่คุยกัน
// ใช้แสดงในแท็บ "แชทล่าสุด" ทางซ้ายของจอ
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.user_id AS id, p.name, c.last_message, c.last_sender_id, c.last_message_at
       FROM (
         SELECT DISTINCT ON (other_id) other_id, content AS last_message,
                sender_id AS last_sender_id, created_at AS last_message_at
         FROM (
           SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS other_id,
                  sender_id, content, created_at
           FROM messages
           WHERE sender_id = $1 OR receiver_id = $1
         ) sub
         ORDER BY other_id, created_at DESC
       ) c
       JOIN profiles p ON p.user_id = c.other_id
       WHERE NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = $1 AND b.blocked_id = c.other_id)
            OR (b.blocked_id = $1 AND b.blocker_id = c.other_id)
       )
       ORDER BY c.last_message_at DESC
       LIMIT 100`,
      [req.userId]
    );

    res.json({
      conversations: result.rows.map((r) => ({
        id: r.id,
        name: r.name,
        lastMessage: r.last_message,
        lastMessageFromMe: r.last_sender_id === req.userId,
        lastMessageAt: r.last_message_at,
        online: onlineUserIds.has(r.id)
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดรายการแชทไม่สำเร็จ" });
  }
});

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
