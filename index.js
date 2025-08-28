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
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8 // Increase buffer size for image data
});

// Store room data for better management
const rooms = new Map();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use("/user", uservideoroute);

// Middleware to validate room IDs
const validateRoomId = (roomId) => {
  return typeof roomId === 'string' && roomId.length > 0 && roomId.length < 50;
};

io.of("/user").on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);
  
  // Track user's room and username
  let currentRoom = null;
  let username = "User";

  socket.on("join-room", (data) => {
    const { roomId, username: user } = data;
    if (!validateRoomId(roomId)) {
      socket.emit("error", "Invalid room ID");
      return;
    }

    try {
      // Store username
      if (user) username = user;
      
      // Leave previous room if any
      if (currentRoom) {
        socket.leave(currentRoom);
      }
      
      socket.join(roomId);
      currentRoom = roomId;
      console.log(`📌 ${socket.id} (${username}) joined room: ${roomId}`);

      // Initialize room data if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          participants: new Map(),
          host: null,
          createdAt: new Date()
        });
      }
      
      const roomData = rooms.get(roomId);
      roomData.participants.set(socket.id, { username });

      // If host (first user in room)
      if (roomData.participants.size === 1) {
        roomData.host = socket.id;
        socket.emit("host");
        console.log("🎥 Sent HOST event to:", socket.id);
      }

      // Notify others in the room
      socket.to(roomId).emit("user-joined", { 
        userId: socket.id, 
        username 
      });
      
      // Send participant count to all users in the room
      io.of("/user").to(roomId).emit("participant-count", roomData.participants.size);
      
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", "Failed to join room");
    }
  });

  // Handle video frames
  socket.on("video-frame", (data) => {
    if (!validateRoomId(data.roomId)) return;
    
    // Broadcast to all other users in the room
    socket.to(data.roomId).emit("video-frame", {
      userId: socket.id,
      username: username,
      frame: data.frame
    });
  });

  // Chat message
  socket.on("chat-message", (data) => {
    if (!validateRoomId(data.roomId)) return;
    
    // Validate message
    if (typeof data.message !== 'string' || data.message.trim().length === 0 || data.message.length > 1000) {
      return;
    }
    
    // Broadcast to room
    io.of("/user").to(data.roomId).emit("chat-message", { 
      user: data.user || username, 
      message: data.message.trim(),
      timestamp: data.timestamp || new Date().toISOString()
    });
    
    console.log(`💬 ${socket.id} sent message in room ${data.roomId}`);
  });

  // End call (host only)
  socket.on("end-call", (roomId) => {
    if (!validateRoomId(roomId)) return;
    
    const roomData = rooms.get(roomId);
    if (roomData && roomData.host === socket.id) {
      io.of("/user").to(roomId).emit("end-call");
      console.log(`🚪 Host ended call in room ${roomId}`);
      
      // Clean up room data after a delay
      setTimeout(() => {
        if (rooms.has(roomId)) {
          rooms.delete(roomId);
          console.log(`🧹 Cleaned up room ${roomId}`);
        }
      }, 5000);
    }
  });

  // Handle disconnect
  socket.on("disconnecting", (reason) => {
    console.log(`❌ User disconnecting: ${socket.id}, reason: ${reason}`);
    
    // Notify all rooms the user is in
    const roomsToLeave = Array.from(socket.rooms).filter(roomId => roomId !== socket.id);
    
    roomsToLeave.forEach(roomId => {
      socket.to(roomId).emit("user-left", socket.id);
      
      // Update room data
      if (rooms.has(roomId)) {
        const roomData = rooms.get(roomId);
        roomData.participants.delete(socket.id);
        
        // If host left, assign new host
        if (roomData.host === socket.id && roomData.participants.size > 0) {
          const newHost = Array.from(roomData.participants.keys())[0];
          roomData.host = newHost;
          io.of("/user").to(newHost).emit("host");
          console.log(`👑 New host assigned: ${newHost} in room ${roomId}`);
        }
        
        // Send updated participant count
        io.of("/user").to(roomId).emit("participant-count", roomData.participants.size);
        
        // Clean up empty rooms
        if (roomData.participants.size === 0) {
          setTimeout(() => {
            if (rooms.has(roomId) && rooms.get(roomId).participants.size === 0) {
              rooms.delete(roomId);
              console.log(`🧹 Cleaned up empty room ${roomId}`);
            }
          }, 30000); // Wait 30 seconds before cleaning up empty room
        }
      }
    });
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ User disconnected: ${socket.id}, reason: ${reason}`);
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Add health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    rooms: Array.from(rooms.keys()),
    totalParticipants: Array.from(rooms.values()).reduce((acc, room) => acc + room.participants.size, 0)
  });
});

// Add endpoint to get room info
app.get("/room/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  if (!validateRoomId(roomId)) {
    return res.status(400).json({ error: "Invalid room ID" });
  }
  
  const roomData = rooms.get(roomId);
  if (!roomData) {
    return res.status(404).json({ error: "Room not found" });
  }
  
  res.json({
    roomId,
    host: roomData.host,
    participantCount: roomData.participants.size,
    createdAt: roomData.createdAt,
    participants: Array.from(roomData.participants.entries()).map(([id, data]) => ({
      id,
      username: data.username
    }))
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

connect();

const port = process.env.PORT || 3022;
server.listen(port, () => {
  console.log(`✅ Server started at port ${port}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("🛑 Shutting down gracefully...");
  
  // Close all connections
  io.close(() => {
    console.log("✅ Socket.IO server closed");
    server.close(() => {
      console.log("✅ HTTP server closed");
      process.exit(0);
    });
  });
});