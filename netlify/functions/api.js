const express = require('express');
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const svgCaptcha = require('svg-captcha');

const app = express();
app.use(express.json());

const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }
}));

// Database Connection Logic
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        const uri = "mongodb+srv://Abdullah:a555sss1@cluster0.z91ynmj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log("MongoDB Connected Successfully");
    } catch (err) {
        console.error("DB Connection Error:", err.message);
        throw err;
    }
};

let captchaStore = {};
const router = express.Router();

router.get('/captcha', (req, res) => {
    const captcha = svgCaptcha.create({ size: 6, noise: 2, color: true });
    const id = Math.random().toString(36).substring(2, 10);
    captchaStore[id] = captcha.text.toLowerCase();
    setTimeout(() => delete captchaStore[id], 120000);
    res.type('svg').set('x-captcha-id', id).send(captcha.data);
});

router.post('/register', async (req, res) => {
    try {
        await connectDB();
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ email, password: hashedPassword });
        res.json({ message: "Registration successful!" });
    } catch (e) {
        res.status(400).json({ error: "User already exists or DB error." });
    }
});

router.post('/login', async (req, res) => {
    try {
        await connectDB();
        const { email, password, captchaId, captchaAnswer } = req.body;
        if (!captchaStore[captchaId] || captchaStore[captchaId] !== captchaAnswer?.toLowerCase()) {
            return res.status(403).json({ error: "Captcha failed." });
        }
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ email: user.email }, "SECRET", { expiresIn: '1h' });
            return res.json({ token, message: "Login successful!" });
        }
        res.status(401).json({ error: "Invalid email or password." });
    } catch (e) {
        res.status(500).json({ error: "Server error." });
    }
});

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);
