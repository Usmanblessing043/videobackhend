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

  // ✅ Join room
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`📌 ${socket.id} joined room: ${roomId}`);

    const room = io.of("/user").adapter.rooms.get(roomId);

    if (room && room.size === 1) {
      socket.emit("host");
      console.log("🎥 Sent HOST event to:", socket.id);
    }

    // Send existing users to the new user
    const otherUsers = [...room].filter((id) => id !== socket.id);
    socket.emit("all-users", otherUsers);

    // Notify others that a new user joined
    socket.to(roomId).emit("user-joined", { newUserId: socket.id });
  });

  // ✅ Step 1: Caller sends signal
  socket.on("sending-signal", ({ userToSignal, callerId, signal }) => {
    console.log(`📡 ${callerId} ➝ ${userToSignal} [sending-signal]`);
    io.of("/user")
      .to(userToSignal)
      .emit("receiving-signal", { signal, callerId });
  });

  // ✅ Step 2: Callee returns signal
  socket.on("returning-signal", ({ signal, callerId }) => {
    console.log(`📡 ${socket.id} ➝ ${callerId} [returning-signal]`);
    io.of("/user")
      .to(callerId)
      .emit("receiving-returned-signal", { signal, id: socket.id });
  });

  // ✅ Chat
  socket.on("chat-message", ({ roomId, user, message }) => {
    io.of("/user").to(roomId).emit("chat-message", { user, message });
  });

  // ✅ Host ends call
  socket.on("end-call", (roomId) => {
    io.of("/user").to(roomId).emit("end-call");
    console.log(`🚪 Host ended call in room ${roomId}`);
  });

  // ✅ Handle disconnects
  socket.on("disconnecting", () => {
    [...socket.rooms].forEach((roomId) => {
      if (roomId !== socket.id) {
        socket.to(roomId).emit("user-left", socket.id);
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

connect();

const port = 3022;
server.listen(port, () => {
  console.log(`✅ Server started at port ${port}`);
});
