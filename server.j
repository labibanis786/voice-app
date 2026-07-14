const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const cors = require("cors");

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

let rooms = {};

// Login API
app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (email === "admin@voice.com" && password === "admin123") {
        res.json({ success: true, user: { userId: "12345", name: "RK ROCK", followers: 100, following: 50, visitors: 10 } });
    } else {
        res.status(401).json({ success: false, message: "Invalid" });
    }
});

// Room Create API (Room ID = Profile/User ID)
app.post("/api/room/create", (req, res) => {
    const { roomName, userId, userName } = req.body;
    const roomId = userId; 
    rooms[roomId] = { 
        roomId, roomName, hostId: userId, hostName: userName, 
        admins: [userId], users: {} 
    };
    io.emit("room-list-update", Object.values(rooms));
    res.json({ success: true, roomId });
});

// Socket Logic
io.on("connection", (socket) => {
    socket.on("manage-user", (data) => {
        const { roomId, targetId, action } = data;
        if (!rooms[roomId]) return;

        if (action === 'kick') {
            // কিক আউট লজিক: ইউজারকে রুম থেকে বের করে দেওয়া
            delete rooms[roomId].users[targetId];
            io.to(targetId).emit("kicked-out", "You were kicked by owner");
        } 
        else if (action === 'admin') {
            // এডমিন দেওয়ার লজিক
            if (!rooms[roomId].admins.includes(targetId)) {
                rooms[roomId].admins.push(targetId);
            }
        }
        io.to(roomId).emit("role-updated", rooms[roomId].admins);
    });
});

http.listen(8080, () => console.log("Server running on port 8080"));
