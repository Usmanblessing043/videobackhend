const express = require("express");
const app = express();
const connect = require("./Dbconfiguration/db.connect");
const uservideoroute = require("./routes/user.routes");
require("dotenv").config();
const cors = require("cors");

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use("/user", uservideoroute);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('join-room', ({ roomId, userInfo }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userInfo = userInfo;
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      id: socket.id,
      name: userInfo.name,
      avatar: userInfo.avatar,
      isMuted: false,
      isVideoOff: false,
      isHost: false
    });
    
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Handle mute toggle
  socket.on('toggle-mute', ({ roomId, isMuted }) => {
    socket.to(roomId).emit('user-muted', {
      userId: socket.id,
      isMuted
    });
  });

  // Handle video toggle
  socket.on('toggle-video', ({ roomId, isVideoOff }) => {
    socket.to(roomId).emit('user-video-toggle', {
      userId: socket.id,
      isVideoOff
    });
  });

  // Leave room
  socket.on('leave-room', (roomId) => {
    socket.to(roomId).emit('user-left', socket.id);
    socket.leave(roomId);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-left', socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

connect();

const port = process.env.PORT || 3022;
server.listen(port, () => {
  console.log(`✅ Server started at port ${port}`);
});
