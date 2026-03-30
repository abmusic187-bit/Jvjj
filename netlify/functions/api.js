const express = require('express');
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());

const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    goldTokens: { type: Number, default: 0 }
}));

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    const uri = "mongodb+srv://Abdullah:a555sss1@cluster0.z91ynmj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
    await mongoose.connect(uri);
};

const router = express.Router();

router.post('/register', async (req, res) => {
    await connectDB();
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        // Start users with 10 free tokens
        await User.create({ email, password: hashedPassword, goldTokens: 10 });
        res.json({ message: "Account Created! You got 10 Free Gold Tokens!" });
    } catch (e) { res.status(400).json({ error: "User already exists." }); }
});

router.post('/login', async (req, res) => {
    await connectDB();
    const user = await User.findOne({ email: req.body.email });
    if (user && await bcrypt.compare(req.body.password, user.password)) {
        return res.json({ email: user.email, tokens: user.goldTokens, message: "Welcome to the Draw!" });
    }
    res.status(401).json({ error: "Wrong email or password." });
});

router.post('/draw', async (req, res) => {
    await connectDB();
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.goldTokens < 1) return res.status(400).json({ error: "Not enough tokens!" });

    // Deduct 1 token to play, then 40% chance to win 5 tokens
    user.goldTokens -= 1;
    const win = Math.random() < 0.4;
    const prize = win ? 5 : 0;
    user.goldTokens += prize;
    await user.save();

    res.json({ 
        win, 
        newTotal: user.goldTokens, 
        message: win ? `WINNER! You won ${prize} Gold Tokens!` : "No luck! Try again." 
    });
});

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);
