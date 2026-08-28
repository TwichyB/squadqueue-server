const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const pool = require("./db");

// In-memory presence tracking. Fine for a single server instance;
// scaling to multiple instances would need a shared store (e.g. Redis).
const onlineUserIds = new Set();
const socketsByUser = new Map(); // userId -> Set(socket.id)

function setupSockets(io) {
  io.use((socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie || "";
      const parsed = cookie.parse(raw);
      const token = parsed.token;
      if (!token) return next(new Error("unauthorized"));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.uid;
      next();
    } catch (err) {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;

    if (!socketsByUser.has(userId)) socketsByUser.set(userId, new Set());
    socketsByUser.get(userId).add(socket.id);
    socket.join("user:" + userId);

    const wasOffline = !onlineUserIds.has(userId);
    onlineUserIds.add(userId);
    if (wasOffline) io.emit("presence:update", { userId, online: true });

    socket.on("chat:send", async (payload, ack) => {
      try {
        const to = parseInt(payload && payload.to, 10);
        const content = String((payload && payload.content) || "").trim().slice(0, 1000);
        if (!Number.isInteger(to) || !content) {
          if (typeof ack === "function") ack({ ok: false, error: "ข้อความไม่ถูกต้อง" });
          return;
        }

        const result = await pool.query(
          "INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING id, sender_id, receiver_id, content, created_at",
          [userId, to, content]
        );
        const row = result.rows[0];

        io.to("user:" + userId).emit("chat:message", {
          id: row.id,
          from: "me",
          senderId: row.sender_id,
          receiverId: row.receiver_id,
          text: row.content,
          ts: row.created_at
        });
        io.to("user:" + to).emit("chat:message", {
          id: row.id,
          from: "them",
          senderId: row.sender_id,
          receiverId: row.receiver_id,
          text: row.content,
          ts: row.created_at
        });

        if (typeof ack === "function") ack({ ok: true });
      } catch (err) {
        console.error(err);
        if (typeof ack === "function") ack({ ok: false, error: "ส่งข้อความไม่สำเร็จ" });
      }
    });

    socket.on("disconnect", () => {
      const set = socketsByUser.get(userId);
      if (!set) return;
      set.delete(socket.id);
      if (set.size === 0) {
        socketsByUser.delete(userId);
        onlineUserIds.delete(userId);
        io.emit("presence:update", { userId, online: false });
      }
    });
  });
}

module.exports = { setupSockets, onlineUserIds };
