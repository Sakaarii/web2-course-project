const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require("path");
const { NotFoundError, ValidationError } = require("../lib/errors");
const { z } = require("zod");

const ChoiceInput = z.object({
  text: z.string().min(1).max(255),
  isCorrect: z.union([z.boolean(), z.string()]).transform((v) =>
    typeof v === "string" ? v === "true" : v,
  ),
});

const TextQuestionInput = z.object({
  type: z.literal("TEXT").optional(),
  question: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.union([z.string(), z.array(z.string())]).optional(),
});

const MultipleChoiceQuestionInput = z.object({
  type: z.literal("MULTIPLE_CHOICE"),
  question: z.string().min(1),
  keywords: z.union([z.string(), z.array(z.string())]).optional(),
  choices: z
    .union([z.string(), z.array(ChoiceInput)])
    .transform((v) => (typeof v === "string" ? JSON.parse(v) : v))
    .pipe(z.array(ChoiceInput).min(2).max(4)),
});

function parseQuestionInput(body) {
  const type = body.type || "TEXT";
  if (type === "MULTIPLE_CHOICE") {
    const parsed = MultipleChoiceQuestionInput.parse(body);
    const correctCount = parsed.choices.filter((c) => c.isCorrect).length;
    if (correctCount !== 1) {
      throw new ValidationError("Exactly one choice must be marked correct");
    }
    parsed.answer = parsed.choices.find((c) => c.isCorrect).text;
    return parsed;
  }
  const parsed = TextQuestionInput.parse(body);
  return { ...parsed, type: "TEXT", choices: null };
}

function normalizeKeywords(kw) {
  if (kw == null) return [];
  const arr = Array.isArray(kw) ? kw : kw.split(",");
  return arr.map((s) => s.trim()).filter(Boolean);
}

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
      return cb(null, true);
    }
    return cb(new Error("Only image files are allowed!"), false);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

router.use(authenticate);

const formatQuestion = (question, { includeCorrect = false } = {}) => {
  return {
    ...question,
    userName: question.user ? question.user.name : null,
    attempted: question.attempts && question.attempts.length > 0,
    AttemptCount: question._count ? question._count.attempts : 0,
    keywords: question.keywords ? question.keywords.map((k) => k.name) : [],
    choices: question.choices
      ? question.choices.map((c) => ({
          id: c.id,
          text: c.text,
          ...(includeCorrect ? { isCorrect: c.isCorrect } : {}),
        }))
      : [],
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
        choices: true,
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
    data: filteredQuestions.map((q) => formatQuestion(q)),
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
    include: { keywords: true, choices: true, user: true },
  });
  if (!question) {
    throw new NotFoundError("Question not found");
  }
  const includeCorrect = question.userId === req.user.userId;
  res.json(formatQuestion(question, { includeCorrect }));
});

// POST /api/questions
router.post("/", upload.single("image"), async (req, res) => {
  const parsed = parseQuestionInput(req.body);
  const { question, answer, keywords, type, choices } = parsed;

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const newQuestion = await prisma.question.create({
    data: {
      question,
      type,
      imageUrl,
      keywords: {
        connectOrCreate: normalizeKeywords(keywords).map((keyword) => ({
          where: { name: keyword },
          create: { name: keyword },
        })),
      },
      answer,
      userId: req.user.userId,
      ...(choices
        ? {
            choices: {
              create: choices.map((c) => ({
                text: c.text,
                isCorrect: c.isCorrect,
              })),
            },
          }
        : {}),
    },
    include: { keywords: true, choices: true, user: true },
  });

  res.status(201).json(formatQuestion(newQuestion, { includeCorrect: true }));
});

// POST /api/questions/:id/play
router.post("/:id/play", async (req, res) => {
  const { id } = req.params;
  const question = await prisma.question.findUnique({
    where: { id: parseInt(id) },
    include: { choices: true },
  });
  if (!question) {
    throw new NotFoundError("Question not found");
  }

  let correct = false;
  let submittedAnswer = null;

  if (question.type === "MULTIPLE_CHOICE") {
    const choiceId = parseInt(req.body.choiceId);
    if (!choiceId) {
      throw new ValidationError("choiceId is required");
    }
    const chosen = question.choices.find((c) => c.id === choiceId);
    if (!chosen) {
      throw new ValidationError("Invalid choice for this question");
    }
    correct = chosen.isCorrect;
    submittedAnswer = chosen.text;
  } else {
    if (typeof req.body.answer !== "string") {
      throw new ValidationError("answer is required");
    }
    submittedAnswer = req.body.answer;
    correct = question.answer.toLowerCase() === submittedAnswer.toLowerCase();
  }

  res.json({
    id: question.id,
    createdAt: new Date(),
    correct,
    correctAnswer: question.answer,
    submittedAnswer,
  });
});

// PUT /api/questions/:id
router.put("/:id", upload.single("image"), isOwner, async (req, res) => {
  const { id } = req.params;
  const existingQuestion = await prisma.question.findUnique({
    where: { id: parseInt(id) },
    include: { keywords: true, choices: true, user: true },
  });
  if (!existingQuestion) {
    throw new NotFoundError("Question not found");
  }

  const parsed = parseQuestionInput(req.body);
  const { question, answer, keywords, type, choices } = parsed;

  const imageUrl = req.file
    ? `/uploads/${req.file.filename}`
    : existingQuestion.imageUrl;

  const updatedQuestion = await prisma.$transaction(async (tx) => {
    await tx.choice.deleteMany({ where: { questionId: parseInt(id) } });
    return tx.question.update({
      where: { id: parseInt(id) },
      data: {
        question,
        type,
        keywords: {
          set: [],
          connectOrCreate: normalizeKeywords(keywords).map((keyword) => ({
            where: { name: keyword },
            create: { name: keyword },
          })),
        },
        answer,
        imageUrl,
        ...(choices
          ? {
              choices: {
                create: choices.map((c) => ({
                  text: c.text,
                  isCorrect: c.isCorrect,
                })),
              },
            }
          : {}),
      },
      include: { keywords: true, choices: true, user: true },
    });
  });

  res.json(formatQuestion(updatedQuestion, { includeCorrect: true }));
});

// DELETE /api/questions/:id
router.delete("/:id", isOwner, async (req, res) => {
  const { id } = req.params;
  const existingQuestion = await prisma.question.findUnique({
    where: { id: parseInt(id) },
    include: { keywords: true, choices: true, user: true },
  });
  if (!existingQuestion) {
    throw new NotFoundError("Question not found");
  }
  const deletedQuestion = await prisma.question.delete({
    where: { id: parseInt(id) },
    include: { keywords: true, choices: true, user: true },
  });

  res.json({
    message: "Question deleted successfully",
    question: formatQuestion(deletedQuestion, { includeCorrect: true }),
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
