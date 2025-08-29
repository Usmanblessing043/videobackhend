const express = require("express");
const app = express();
const connect = require("./Dbconfiguration/db.connect");
const uservideoroute = require("./routes/user.routes");
require("dotenv").config();
const cors = require("cors");

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Update this to your frontend's URL in production
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use("/user", uservideoroute);

connect();

io.on("connection", (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);

  // Join a room
  socket.on("join-room", (roomId, userId) => {
    console.log(`User ${userId} joined room ${roomId}`);
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", userId);

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });
  socket.on("signal", ({ userToSignal, callerID, signal }) => {
    io.to(userToSignal).emit("signal", { userId: callerID, signal });
  });
});

const port = process.env.PORT || 3022;
server.listen(port, () => {
  console.log(`✅ Server started at port ${port}`);
});