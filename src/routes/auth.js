const express = require('express');
const router = express.Router();
const prisma = require("../lib/prisma")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const SECRET = process.env.JWT_SECRET


router.post("/register", async (req, res)=> {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: {
            email,
            username,
            password: hashedPassword
        }
    });

    const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "1h" });
    res.status(201).json({ message: "User registered successfully", token });
})


router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return res.status(400).json({ error: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "1h" });
    res.json({ message: "Login successful", token });
})

module.exports = router;