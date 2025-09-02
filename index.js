const express = require("express");
const app = express();
const connect = require("./Dbconfiguration/db.connect");
const uservideoroute = require("./routes/user.routes");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const corsOptions = {
  origin: "*", // Update this to your frontend's URL in production,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions))
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({extended:true}));
app.use("/", uservideoroute);

connect();

const io = new Server(server, { cors: corsOptions });

// Track online users { userId: socketId }
const onlineUsers = {};
// Track rooms metadata { roomId: { adminId, participants: Map(socketId -> username) } }
const roomsMeta = {};
// Track socket -> rooms
const socketRooms = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Unauthorized: No token"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.username = decoded.email || decoded.name || "Guest";
    next();
  } catch (err) {
    next(new Error("Unauthorized: Invalid token"));
  }
});

io.on("connection", (socket) => {
  onlineUsers[socket.userId] = socket.id;
  const joinedRooms = new Set();
  socketRooms.set(socket.id, joinedRooms);

  // ===== Join a meeting room =====
  socket.on("join-room", ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
    joinedRooms.add(roomId);

    // Mark admin if room first time
    if (!roomsMeta[roomId]) {
      roomsMeta[roomId] = {
        adminId: socket.userId,
        participants: new Map(),
      };
    }
    roomsMeta[roomId].participants.set(socket.id, socket.username);

    // Notify existing users
    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      userId: socket.userId,
      username: socket.username,
    });

    // Send back room info
    io.to(socket.id).emit("room-info", {
      roomId,
      adminId: roomsMeta[roomId].adminId,
      participants: Array.from(roomsMeta[roomId].participants.entries()).map(
        ([sid, uname]) => ({ socketId: sid, username: uname })
      ),
    });
  });

  // ===== Leave a meeting room =====
  socket.on("leave-room", ({ roomId }) => {
    if (!roomId) return;
    socket.leave(roomId);
    joinedRooms.delete(roomId);

    if (roomsMeta[roomId]) {
      roomsMeta[roomId].participants.delete(socket.id);

      // If room is empty, cleanup
      if (roomsMeta[roomId].participants.size === 0) {
        delete roomsMeta[roomId];
      } else {
        socket.to(roomId).emit("user-left", { socketId: socket.id });
      }
    }
  });

  // ===== Handle chat messages =====
  socket.on("chat-message", ({ roomId, text }) => {
    if (!roomId || !text) return;
    const payload = {
      socketId: socket.id,
      userId: socket.userId,
      username: socket.username,
      text,
      time: new Date().toISOString(),
    };
    io.to(roomId).emit("chat-message", payload);
  });

  // ===== End meeting =====
  socket.on("end-meeting", ({ roomId }) => {
    if (!roomId || !roomsMeta[roomId]) return;
    const isAdmin = roomsMeta[roomId].adminId === socket.userId;

    if (isAdmin) {
      // Notify everyone meeting ended
      io.to(roomId).emit("end-meeting", { byAdmin: true });
      // Cleanup
      delete roomsMeta[roomId];
    } else {
      // Only this user leaves
      socket.emit("end-meeting", { byAdmin: false });
      socket.leave(roomId);
      joinedRooms.delete(roomId);

      if (roomsMeta[roomId]) {
        roomsMeta[roomId].participants.delete(socket.id);
        socket.to(roomId).emit("user-left", { socketId: socket.id });
      }
    }
  });

  // ===== WebRTC signaling =====
  socket.on("signal", ({ roomId, to, data }) => {
    if (!roomId || !data) return;
    if (to) {
      io.to(to).emit("signal", { from: socket.id, data });
    } else {
      socket.to(roomId).emit("signal", { from: socket.id, data });
    }
  });

  socket.on("disconnect", () => {
    const rooms = socketRooms.get(socket.id) || new Set();
    rooms.forEach((roomId) => {
      if (roomsMeta[roomId]) {
        roomsMeta[roomId].participants.delete(socket.id);
        socket.to(roomId).emit("user-left", { socketId: socket.id });
        if (roomsMeta[roomId].participants.size === 0) {
          delete roomsMeta[roomId];
        }
      }
    });
    socketRooms.delete(socket.id);
    delete onlineUsers[socket.userId];
  });
});















const port = process.env.PORT || 3022;
server.listen(port, () => {
  console.log(`✅ Server started at port ${port}`);
});