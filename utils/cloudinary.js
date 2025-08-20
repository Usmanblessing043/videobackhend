const cloudinary = require('cloudinary').v2;
const env = require("dotenv").config()
env

cloudinary.config({
     cloud_name: process.env.CLOUDNAME, 
     api_key: process.env.CLOUD_APIKEY ,
     api_secret: process.env.CLOUD_APISECRET 
})

module.exports = cloudinary