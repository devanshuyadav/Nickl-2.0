const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Falls back to a local 'nickl' database if the URI isn't in .env
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/nickl');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;