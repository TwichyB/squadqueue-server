require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET environment variable. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const path = require("path");
const http = require("http");
const express = require("express");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const candidatesRoutes = require("./routes/candidates");
const chatRoutes = require("./routes/chat");
const reputationRoutes = require("./routes/reputation");
const { setupSockets } = require("./socket");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/candidates", candidatesRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/users", reputationRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
setupSockets(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("MosUP server listening on port " + PORT);
});
