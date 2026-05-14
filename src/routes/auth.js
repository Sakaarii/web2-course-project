const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const {
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} = require("../lib/errors");
const SECRET = process.env.JWT_SECRET;

router.post("/register", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    throw new ValidationError("Email, username or passwords missing");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ConflictError("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
    },
  });

  const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "1h" });
  res.status(201).json({ message: "User registered successfully", token });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError("Email or passwords missing");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ForbiddenError("Invalid Credentials");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new UnauthorizedError("Invalid Credentials");
  }

  const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "1h" });
  res.json({ message: "Login successful", token });
});

module.exports = router;
