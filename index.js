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

    // Tell existing users someone joined
    const otherUsers = [...room].filter((id) => id !== socket.id);
    socket.emit("all-users", otherUsers);

    // Tell everyone else about the new user
    socket.to(roomId).emit("user-joined", { callerId: socket.id });
  });

  // ✅ Simple-peer signaling
  socket.on("sending-signal", ({ userToSignal, callerId, signal }) => {
    console.log(`📡 ${callerId} ➝ ${userToSignal} [sending-signal]`);
    io.of("/user").to(userToSignal).emit("user-joined", { signal, callerId });
  });

  socket.on("returning-signal", ({ signal, callerId }) => {
    console.log(`📡 ${socket.id} ➝ ${callerId} [returning-signal]`);
    io.of("/user").to(callerId).emit("signal", { signal, callerId: socket.id });
  });

  // ✅ Chat messages
  socket.on("chat-message", ({ roomId, user, message }) => {
    io.of("/user").to(roomId).emit("chat-message", { user, message });
  });

  // ✅ End call by host
  socket.on("end-call", (roomId) => {
    io.of("/user").to(roomId).emit("end-call");
    console.log(`🚪 Host ended call in room ${roomId}`);
  });

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
