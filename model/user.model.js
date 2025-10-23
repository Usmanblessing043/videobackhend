const mongoose = require ('mongoose')
const uservideoschema = mongoose.Schema({
    username:{type: String, trim:true, required:true},
    email:{type: String, trim:true, unique:true, required:true},
    password:{type: String, trim:true, required:true},
    profilePic:{type:String},
    resetToken:{type:String},
    resetTokenExpire:{type:Date},
}, {timestamp:true})

const uservideomodel = mongoose.model('uservideo_collection', uservideoschema)


module.exports =  {uservideomodel}