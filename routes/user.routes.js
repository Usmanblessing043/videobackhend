const express =  require ('express')
 const uservideoroute  = express.Router()
const { Signup, Login, Verifytoken, Uploadprofile, Createroom } = require ("../controller/user.controller")


uservideoroute.post("/signup",Signup)
uservideoroute.post("/login", Login)
uservideoroute.post("/createroom", Createroom)
uservideoroute.get("/Verify",Verifytoken)
uservideoroute.patch("/Upload/:userid",Uploadprofile)

module.exports = uservideoroute
