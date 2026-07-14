const mongoose = require("mongoose");

async function connectDatabase() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        
        if (!mongoUri) {
            throw new Error("MONGODB_URI not found in .env file");
        }

        await mongoose.connect(mongoUri, {
            autoIndex: true,
            serverSelectionTimeoutMS: 5000
        });

        console.log("✅ MongoDB Connected Successfully");
        console.log(`📊 Database: ${mongoose.connection.name}`);

    } catch (error) {
        console.error("❌ MongoDB Connection Failed");
        console.error(error.message);
        process.exit(1);
    }
}

// MongoDB connection events
mongoose.connection.on("disconnected", () => {
    console.log("⚠️ MongoDB Disconnected");
});

mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB Error:", err);
});

module.exports = connectDatabase;
