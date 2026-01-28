const express = require("express");
const app = express();
const connect = require("./Dbconfiguration/db.connect");
const uservideoroute = require("./routes/user.routes");
const { connectToSocket } = require("./controller/socketManager") ;
require("dotenv").config();
const cors = require("cors");
const http = require("http");
const {Server} = require("socket.io");
const server = http.createServer(app);
const io = connectToSocket(server)


app.use(cors())
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({extended:true}));
app.use("/", uservideoroute);

const users = {}
const socketToRoom = {}
connect();










const port = 3022;
server.listen(port, () => {
  console.log(` Server started at port ${port}`);
});