const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require("path");
const { timeStamp } = require("console");
const { NotFoundError, ValidationError } = require("../lib/errors");
const { z } = require("zod");

const QuestionInput = z.object({
  question: z.string().min(1),
  date: z.string().date(),
  answer: z.string().min(1),
  keywords: z.union([z.string(), z.array(z.string())]).optional(),
});

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const newName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, newName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }

    limits: {
      fileSize: 5 * 1024 * 1024;
    } // 5MB
  },
});

router.use((err, req, res, next) => {
  if (
    err instanceof multer.MulterError ||
    err?.message === "Only image files are allowed"
  ) {
    return res.status(400).json({ msg: err.message });
  }
  next(err);
});

router.use(authenticate);

const formatQuestion = (question) => {
  return {
    ...question,
    userName: question.user ? question.user.name : null,
    attempted: question.attempts && question.attempts.length > 0,
    AttemptCount: question._count ? question._count.attempts : 0,
    keywords: question.keywords ? question.keywords.map((k) => k.name) : [],
    user: undefined,
    attempts: undefined,
    _count: undefined,
  };
};

// GET /api/questions, /api/questions?keyword=france&page=1&limit=5
router.get("/", async (req, res) => {
  const { keyword } = req.query;

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 5);
  const skip = (page - 1) * limit;

  const where = keyword ? { keywords: { some: { name: keyword } } } : {};

  const [filteredQuestions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        keywords: true,
        user: true,
        attempts: { where: { userId: req.user.userId }, take: 1 },
        _count: { select: { attempts: true } },
      },
      orderBy: { id: "asc" },
      skip,
      take: limit,
    }),
    prisma.question.count({ where }),
  ]);

  res.json({
    data: filteredQuestions.map(formatQuestion),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/questions/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const question = await prisma.question.findUnique({
    where: { id: parseInt(id) },
    include: { keywords: true, user: true },
  });
  if (!question) {
    throw new NotFoundError("Question not found");
  }
  res.json(formatQuestion(question));
});

// POST /api/questions
router.post("/", upload.single("image"), async (req, res) => {
  const { question, answer, keywords } = QuestionInput.parse(req.body);

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const newQuestion = await prisma.question.create({
    data: {
      question,
      imageUrl,
      keywords: {
        connectOrCreate: keywords.map((keyword) => ({
          where: { name: keyword },
          create: { name: keyword },
        })),
      },
      answer,
      userId: req.user.userId,
    },
    include: { keywords: true, user: true },
  });

  res.status(201).json(formatQuestion(newQuestion));
});

// POST /api/questions/:id/play

router.post("/:id/play", async (req, res) => {
  const { id } = req.params;
  const question = await prisma.question.findUnique({
    where: { id: parseInt(id) },
  });
  if (!question) {
    throw new NotFoundError("Question not found");
  }

  if (question.answer.toLowerCase() === req.body.answer.toLowerCase()) {
    res.json({
      id: question.id,
      createdAt: new Date(),
      correct: true,
      correctAnswer: question.answer,
      submittedAnswer: req.body.answer,
    });
  } else {
    res.json({
      id: question.id,
      createdAt: new Date(),
      correct: false,
      correctAnswer: question.answer,
      submittedAnswer: req.body.answer,
    });
  }
});

// PUT /api/questions/:id
router.put("/:id", upload.single("image"), isOwner, async (req, res) => {
  const { id } = req.params;
  const existingQuestion = await prisma.question.findUnique({
    where: { id: parseInt(id) },
    include: { keywords: true, user: true },
  });
  if (!existingQuestion) {
    throw new NotFoundError("Question not found");
  }

  const { question, answer, keywords } = QuestionInput.parse(req.body);

  const imageUrl = req.file
    ? `/uploads/${req.file.filename}`
    : existingQuestion.imageUrl;

  const updatedQuestion = await prisma.question.update({
    where: { id: parseInt(id) },
    data: {
      question,
      keywords: {
        connectOrCreate: keywords.map((keyword) => ({
          where: { name: keyword },
          create: { name: keyword },
        })),
      },
      answer,
      imageUrl,
    },
    include: { keywords: true, user: true },
  });

  res.json(formatQuestion(updatedQuestion));
});

// DELETE /api/questions/:id
router.delete("/:id", isOwner, async (req, res) => {
  const { id } = req.params;
  const existingQuestion = await prisma.question.findUnique({
    where: { id: parseInt(id) },
    include: { keywords: true, user: true },
  });
  if (!existingQuestion) {
    throw new NotFoundError("Question not found");
  }
  const deletedQuestion = await prisma.question.delete({
    where: { id: parseInt(id) },
    include: { keywords: true, user: true },
  });

  res.json({
    message: "Question deleted successfully",
    question: formatQuestion(deletedQuestion),
  });
});

// POST /api/questions/:id/attempt
router.post("/:id/attempt", async (req, res) => {
  const { id } = req.params;
  const question = await prisma.question.findUnique({
    where: { id: parseInt(id) },
  });
  if (!question) {
    throw new NotFoundError("Question not found");
  }

  const attempt = await prisma.attempt.upsert({
    where: {
      userId_questionId: {
        userId: req.user.userId,
        questionId: parseInt(id),
      },
    },
    update: {},
    create: { userId: req.user.userId, questionId: parseInt(id) },
  });

  const attemptCount = await prisma.attempt.count({
    where: { questionId: parseInt(id) },
  });

  res.status(201).json({
    id: attempt.id,
    questionId: id,
    attempted: true,
    attemptCount,
    createdAt: attempt.createdAt,
  });
});

// DELETE /api/questions/:id/attempt
router.delete("/:id/attempt", async (req, res) => {
  const { id } = req.params;
  const question = await prisma.question.findUnique({
    where: { id: parseInt(id) },
  });
  if (!question) {
    throw new NotFoundError("Question not found");
  }

  const attempt = await prisma.attempt.deleteMany({
    where: {
      userId: req.user.userId,
      questionId: parseInt(id),
    },
  });

  const attemptCount = await prisma.attempt.count({
    where: { questionId: parseInt(id) },
  });

  res.status(201).json({
    questionId: id,
    attempted: false,
    attemptCount,
  });
});

module.exports = router;
