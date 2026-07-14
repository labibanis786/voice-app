const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const cors = require("cors");

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// OTP Store + User Store
let otpStore = {}; 
let users = {}; 
let nextUserId = 501; // 501 থেকে শুরু

// Step 1: OTP পাঠাও - Termux এ দেখাবে
app.post("/api/auth/send-otp", (req, res) => {
    const { mobile } = req.body;
    
    if (!mobile || mobile.length!== 10) {
        return res.json({ success: false, message: "10 digit mobile number দাও" });
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000); // 6 digit OTP
    otpStore[mobile] = otp;
    
    console.log(`\n========== OTP SENT ==========`);
    console.log(`Mobile: +91${mobile}`);
    console.log(`OTP: ${otp}`);
    console.log(`==============================\n`);
    
    res.json({ success: true, message: "OTP পাঠানো হয়েছে। Termux দেখো।" });
});

// Step 2: OTP Verify + User Create + ID Generate
app.post("/api/auth/verify-otp", (req, res) => {
    const { mobile, otp } = req.body;
    
    if (otpStore[mobile] && otpStore[mobile] == otp) {
        delete otpStore[mobile]; // OTP used
        
        // পুরানো ইউজার চেক করো
        if (users[mobile]) {
            console.log(`✅ Old User Login: ${users[mobile].name} ID: ${users[mobile].userId}`);
            return res.json({ success: true, user: users[mobile] });
        }
        
        // নতুন ইউজার বানাও
        const userId = nextUserId.toString();
        nextUserId++; // পরের জনের জন্য +1
        
        const newUser = {
            userId: userId,
            name: `User_${userId}`,
            mobile: mobile,
            photo: "",
            followers: 0,
            following: 0,
            visitors: 0,
            coins: 100,
            level: 1,
            vipLevel: 0
        };
        
        users[mobile] = newUser;
        console.log(`✅ New User Created: ${newUser.name} ID: ${newUser.userId} Mobile: ${mobile}`);
        
        res.json({ success: true, user: newUser });
    } else {
        res.json({ success: false, message: "ভুল OTP" });
    }
});

let rooms = {
    "65135972": {
        roomId: "65135972",
        roomName: "কফি হাউজ",
        hostId: "501",
        hostName: "User_501",
        seats: Array(8).fill(null),
        onlineUsers: [],
        messages: []
    },
    "65135973": {
        roomId: "65135973",
        roomName: "আড্ডা ঘর",
        hostId: "501",
        hostName: "User_501",
        seats: Array(8).fill(null),
        onlineUsers: [],
        messages: []
    }
};

app.post("/api/room/create", (req, res) => {
    const { roomName, userId, userName } = req.body;
    const roomId = Date.now().toString();
    
    rooms[roomId] = {
        roomId,
        roomName: roomName || "My Room",
        hostId: userId,
        hostName: userName,
        seats: Array(8).fill(null),
        onlineUsers: [],
        messages: []
    };
    
    console.log("✅ Room Created:", roomName, roomId);
    
    const roomList = Object.values(rooms).map(r => ({
        roomId: r.roomId,
        roomName: r.roomName,
        hostName: r.hostName,
        onlineCount: r.onlineUsers.length
    }));
    io.emit("room-list", roomList);
    
    res.json({ success: true, room: rooms[roomId] });
});

io.on("connection", (socket) => {
    console.log("✅ Socket Connected:", socket.id);

    socket.on("get-rooms", () => {
        const roomList = Object.values(rooms).map(r => ({
            roomId: r.roomId,
            roomName: r.roomName,
            hostName: r.hostName,
            onlineCount: r.onlineUsers.length
        }));
        socket.emit("room-list", roomList);
    });

    socket.on("join-room", (data) => {
        const { roomId, userId, userName, userPhoto } = data;
        socket.join(roomId);
        socket.userId = userId;
        socket.userName = userName;
        socket.userPhoto = userPhoto;
        socket.currentRoom = roomId;
        
        const room = rooms[roomId];
        if (room &&!room.onlineUsers.find(u => u.userId === userId)) {
            room.onlineUsers.push({
    userId,
    userName,
    userPhoto,
    socketId: socket.id
});
        }
        
        console.log(`✅ ${userName} joined ${room?.roomName}`);

io.to(roomId).emit("room-state", room);

io.to(roomId).emit("user-count", {
    count: room.onlineUsers.length
});
});
    socket.on("leave-room", (data) => {
        const { roomId, userId } = data;
        socket.leave(roomId);
        const room = rooms[roomId];
        if (room) {
            room.seats.forEach((seat, i) => {
                if (seat && seat.userId === userId) {
                    room.seats[i] = null;
                    io.to(roomId).emit("seat-update", { seatNumber: i + 1, action: "leave" });
                }
            });
            room.onlineUsers = room.onlineUsers.filter(u => u.userId!== userId);
            io.to(roomId).emit("user-count", { count: room.onlineUsers.length });
        }
        socket.currentRoom = null;
    });

    socket.on("take-seat", (data) => {
        const { roomId, seatNumber } = data;
        const room = rooms[roomId];
        if (!room) return;

        // পুরানো সিট থেকে উঠাও
        room.seats.forEach((seat, i) => {
            if (seat && seat.userId === socket.userId) {
                room.seats[i] = null;
                io.to(roomId).emit("seat-update", { seatNumber: i + 1, action: "leave" });
            }
        });

        room.seats[seatNumber - 1] = {
            userId: socket.userId,
            userName: socket.userName,
            userPhoto: socket.userPhoto
        };
        
        console.log(`✅ ${socket.userName} took seat ${seatNumber}`);
        io.to(roomId).emit("seat-update", {
            seatNumber, action: "take", userName: socket.userName,
            userPhoto: socket.userPhoto, userId: socket.userId
        });
        
        // Voice এর জন্য সিগন্যাল
        socket.to(roomId).emit("user-started-talking", { userId: socket.userId });
    });

    socket.on("send-message", (data) => {
        const { roomId, message } = data;
        const msg = {
            userId: socket.userId, userName: socket.userName, message: message,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
        rooms[roomId].messages.push(msg);
        io.to(roomId).emit("new-message", msg);
    });

    // WebRTC Voice Signaling
    socket.on("voice-offer", (data) => {
        socket.to(data.target).emit("voice-offer", {
            offer: data.offer,
            from: socket.id,
            userId: socket.userId
        });
    });

    socket.on("voice-answer", (data) => {
        socket.to(data.target).emit("voice-answer", {
            answer: data.answer,
            from: socket.id
        });
    });

    socket.on("voice-candidate", (data) => {
        socket.to(data.target).emit("voice-candidate", {
            candidate: data.candidate,
            from: socket.id
        });
    });

    socket.on("disconnect", () => {
        if (socket.currentRoom) {
            const room = rooms[socket.currentRoom];
            if (room) {
                room.seats.forEach((seat, i) => {
                    if (seat && seat.userId === socket.userId) {
                        room.seats[i] = null;
                        io.to(socket.currentRoom).emit("seat-update", { seatNumber: i + 1, action: "leave" });
                    }
                });
                room.onlineUsers = room.onlineUsers.filter(u => u.userId!== socket.userId);
                io.to(socket.currentRoom).emit("user-count", { count: room.onlineUsers.length });
            }
        }
    });
});

http.listen(8080, () => {
    console.log("🚀 Server: http://localhost:8080");
    console.log("📱 OTP Termux এ দেখাবে");
});
