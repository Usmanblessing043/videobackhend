const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connect = require("./Dbconfig/db.connect");
const userRouter = require("./routes/user.route");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ===== CORS SETTINGS =====
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));

// ===== Body parsers =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Routes =====
app.use("/", userRouter);

// ===== DB Connection =====
connect();

// ===== Socket.io =====
const io = new Server(server, {
  cors: corsOptions,
});

// Track online users { userId: socketId }
const onlineUsers = {};

// Track room admins (user who created the meeting)
const roomAdmins = {};

// ===== Socket.io middleware for JWT auth =====
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Unauthorized: No token"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.username = decoded.username; // Assuming username is in JWT
    next();
  } catch (err) {
    next(new Error("Unauthorized: Invalid token"));
  }
});

// room membership: socketId -> Set(roomId)
const socketRooms = new Map();

io.on("connection", (socket) => {
  onlineUsers[socket.userId] = socket.id;

  const joinedRooms = new Set();
  socketRooms.set(socket.id, joinedRooms);

  // ===== Join a meeting room =====
  socket.on("join-room", ({ roomId, username }) => {
    if (!roomId) return;
    
    // If this is the first user joining, set them as admin
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (!roomSockets || roomSockets.size === 0) {
      roomAdmins[roomId] = socket.userId;
    }
    
    socket.join(roomId);
    joinedRooms.add(roomId);
    
    // Notify others in the room
    socket.to(roomId).emit("user-joined", { 
      socketId: socket.id, 
      userId: socket.userId, 
      username: username || socket.username 
    });
    
    // Send existing users to the new user
    if (roomSockets) {
      roomSockets.forEach(existingSocketId => {
        if (existingSocketId !== socket.id) {
          const existingSocket = io.sockets.sockets.get(existingSocketId);
          if (existingSocket) {
            socket.emit("user-joined", { 
              socketId: existingSocketId, 
              userId: existingSocket.userId, 
              username: existingSocket.username 
            });
          }
        }
      });
    }
  });

  // ===== Leave a meeting room =====
  socket.on("leave-room", ({ roomId }) => {
    if (!roomId) return;
    socket.leave(roomId);
    joinedRooms.delete(roomId);
    socket.to(roomId).emit("user-left", { socketId: socket.id });
  });

  // ===== Directed WebRTC signaling (mesh) =====
  socket.on("signal", ({ roomId, to, data }) => {
    if (!roomId || !data) return;
    if (to) {
      io.to(to).emit("signal", { from: socket.id, data });
    } else {
      socket.to(roomId).emit("signal", { from: socket.id, data });
    }
  });

  // ===== Chat message handling =====
  socket.on("send-message", ({ roomId, message }) => {
    if (!roomId || !message) return;
    
    // Add timestamp if not provided
    if (!message.time) {
      message.time = new Date().toLocaleTimeString();
    }
    
    // Broadcast to everyone in the room including sender
    io.to(roomId).emit("receive-message", message);
  });

  // ===== End meeting for all participants =====
  socket.on("end-meeting", ({ roomId }) => {
    if (!roomId) return;
    
    // Check if user is the admin of the room
    if (roomAdmins[roomId] === socket.userId) {
      // Notify all participants
      io.to(roomId).emit("meeting-ended");
      
      // Clear admin for the room
      delete roomAdmins[roomId];
    }
  });

  // ===== Compatibility: direct person-to-person notify (optional; not used now) =====
  socket.on("call-user", ({ toUserId, type }) => {
    const targetSocket = onlineUsers[toUserId];
    if (targetSocket) {
      io.to(targetSocket).emit("incoming-call", {
        fromUserId: socket.userId,
        type,
      });
    }
  });

  socket.on("disconnect", () => {
    const rooms = socketRooms.get(socket.id) || new Set();
    rooms.forEach((rid) => {
      socket.to(rid).emit("user-left", { socketId: socket.id });
      
      // If admin disconnects, clear admin status for room
      if (roomAdmins[rid] === socket.userId) {
        delete roomAdmins[rid];
      }
    });
    socketRooms.delete(socket.id);

    delete onlineUsers[socket.userId];
  });
});

const PORT = process.env.PORT;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { app, io };