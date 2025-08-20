const mongoose = require('mongoose')

const connect = async () => {
    try {
        const connection = await mongoose.connect(process.env.MONGO_URL)
        console.log(connection);
        if (connection) {
            console.log("Database connected successfully");

        }

    } catch (error) {
        console.log(error);
        
    }

}

module.exports = connect