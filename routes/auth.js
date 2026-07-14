const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "master_voice_secret_2026";

let users = [
    {
        userId: "63227294",
        name: "Admin",
        email: "admin@voice.com",
        password: bcrypt.hashSync("admin123", 10),
        photo: "",
        coins: 340,
        diamonds: 3,
        followers: 373,
        following: 12,
        visitors: 2500,
        level: 24,
        vipLevel: 26,
        moments: 22,
        hostBalance: 0.0
    }
];

router.post("/login", async (req, res) => {
    try {
        console.log("Login attempt:", req.body);
        const { email, password } = req.body;
        const user = users.find(u => u.email === email);
        
        if (!user) {
            console.log("User not found");
            return res.status(400).json({ success: false, message: "User not found" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log("Invalid password");
            return res.status(400).json({ success: false, message: "Invalid password" });
        }

        const token = jwt.sign({ userId: user.userId }, JWT_SECRET);
        console.log("Login success for:", user.email);
        res.json({
            success: true,
            message: "Login successful",
            token,
            user: {...user, password: undefined }
        });
    } catch (error) {
        console.log("Login error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;
