const express = require('express');
const router = express.Router();
const prisma = require("../lib/prisma")

// GET /api/questions, /api/questions?option=france
router.get('/', async (req, res) => {
    const { option } = req.query;

    const where = option ? {options: {some: {name: option}}} : {}

    const filteredQuestions = await prisma.question.findMany({
        where,
        include: {options: true},
        orderBy: {id: "asc"}
    })
    
    res.json(filteredQuestions);
})

// GET /api/questions/:id
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const question = await prisma.question.findUnique({
        where: { id: parseInt(id) },
        include: { options: true }
    });
    if (!question) {
        return res.status(404).json({ error: "Question not found" });
    }
    res.json(question);
})

// POST /api/questions
router.post('/', async (req, res) => {
    const { question, options, answer } = req.body;
    if (!question || !options || !answer) {
        return res.status(400).json({ error: "Missing required data" });
    }

    const newQuestion = await prisma.question.create({
        data: {
            question, 
            options: {
                connectOrCreate: options.map(option => ({
                    where: { name: option },
                    create: { name: option }
                }))
            },
            answer
        },
        include: { options: true }
    })
        
    res.status(201).json(newQuestion);
})

// PUT /api/questions/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const existingQuestion = await prisma.question.findUnique({
        where: { id: parseInt(id) },
        include: { options: true }
    });
    if (!existingQuestion) {
        return res.status(404).json({ error: "Question not found" });
    }

    const { question, options, answer } = req.body;
    if (!question || !options || !answer) {
        return res.status(400).json({ error: "Missing required data" });
    }

    const updatedQuestion = await prisma.question.update({
        where: { id: parseInt(id) },
        data: {
            question,
            options: {
                connectOrCreate: options.map(option => ({
                    where: { name: option },
                    create: { name: option }
                }))
            },
            answer
        },
        include: { options: true }
    });

    res.json(updatedQuestion);
})

// DELETE /api/questions/:id
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const existingQuestion = await prisma.question.findUnique({
        where: { id: parseInt(id) },
        include: { options: true }
    });
    if (!existingQuestion) {
        return res.status(404).json({ error: "Question not found" });
    }
    const deletedQuestion = await prisma.question.delete({
        where: { id: parseInt(id) },
        include: { options: true }
    });

    res.json({
        message: "Question deleted successfully",
        question: deletedQuestion
    })
})


module.exports = router;