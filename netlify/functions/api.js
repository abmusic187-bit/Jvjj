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

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    // Hardcoded string with your password as requested
    const uri = "mongodb+srv://Abdullah:a555sss1@cluster0.z91ynmj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
    await mongoose.connect(uri);
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
    await connectDB();
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ email, password: hashedPassword });
        res.json({ message: "Registration Successful! Now Login." });
    } catch (e) { res.status(400).json({ error: "User already exists." }); }
});

router.post('/login', async (req, res) => {
    await connectDB();
    const { email, password, captchaId, captchaAnswer } = req.body;
    if (!captchaStore[captchaId] || captchaStore[captchaId] !== captchaAnswer?.toLowerCase()) {
        return res.status(403).json({ error: "Captcha Failed." });
    }
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ email: user.email }, "SECRET", { expiresIn: '1h' });
        return res.json({ token, message: "Login Successful!" });
    }
    res.status(401).json({ error: "Invalid Credentials." });
});

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);
