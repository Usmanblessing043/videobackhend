const express = require("express");
const app = express();
const connect = require("./Dbconfiguration/db.connect");
const uservideoroute = require("./routes/user.routes");
require("dotenv").config();
const cors = require("cors");

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use("/user", uservideoroute);

io.of("/user").on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`📌 ${socket.id} joined room: ${roomId}`);

    const room = io.of("/user").adapter.rooms.get(roomId);

    // First user is HOST
    if (room && room.size === 1) {
      socket.emit("host");
      console.log("🎥 Sent HOST event to:", socket.id);
    }

    // Notify others in the room
    socket.to(roomId).emit("user-joined", socket.id);

    // Let the new user know about existing participants
    const otherUsers = [...room].filter((id) => id !== socket.id);
    if (otherUsers.length) {
      socket.emit("all-users", otherUsers);
    }

    // Relay WebRTC signaling messages
    socket.on("offer", ({ target, callerId, sdp }) => {
      console.log(`📡 Relaying OFFER from ${callerId} ➝ ${target}`);
      io.of("/user").to(target).emit("offer", { sdp, callerId });
    });

    socket.on("answer", ({ target, callerId, sdp }) => {
      console.log(`📡 Relaying ANSWER from ${callerId} ➝ ${target}`);
      io.of("/user").to(target).emit("answer", { sdp, callerId });
    });

    socket.on("ice-candidate", ({ target, candidate }) => {
      console.log(`❄️ Relaying ICE candidate to ${target}`);
      io.of("/user").to(target).emit("ice-candidate", { candidate, from: socket.id });
    });

    // Chat messages
    socket.on("chat-message", ({ roomId, user, message }) => {
      io.of("/user").to(roomId).emit("chat-message", { user, message });
    });

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);
      socket.to(roomId).emit("user-left", socket.id);
    });
  });
});

connect();

const port = 3022;
server.listen(port, () => {
  console.log(`✅ Server started at port ${port}`);
});
