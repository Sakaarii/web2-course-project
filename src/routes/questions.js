const express = require('express');
const router = express.Router();

const questions = require('../data/questions');

// GET /api/questions, /api/questions?option=france
router.get('/', (req, res) => {
    const { option } = req.query;
    if (!option) {
        res.json(questions);
    }
    const filteredQuestions = questions.filter(q => q.options.includes(option));
    res.json(filteredQuestions);
})

// GET /api/questions/:id
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const question = questions.find(q => q.id === parseInt(id));
    if (!question) {
        return res.status(404).json({ error: "Question not found" });
    }
    res.json(question);
})

// POST /api/questions
router.post('/', (req, res) => {
    const { question, options, answer } = req.body;
    if (!question || !options || !answer) {
        return res.status(400).json({ error: "Missing required data" });
    }
    const existingIds = questions.map(q => q.id);
    const newId = Math.max(...existingIds) + 1;

    const newQuestion = {
        id: questions.length ? newId : 1,
        question: question,
        options: options,
        answer: answer
    }
    questions.push(newQuestion);
    res.status(201).json(newQuestion);
})

// PUT /api/questions/:id
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const existingQuestion = questions.find(q => q.id === parseInt(id));
    if (!existingQuestion) {
        return res.status(404).json({ error: "Question not found" });
    }

    const { question, options, answer } = req.body;
    if (!question || !options || !answer) {
        return res.status(400).json({ error: "Missing required data" });
    }
    existingQuestion.question = question;
    existingQuestion.options = options;
    existingQuestion.answer = answer;
    res.json(existingQuestion);
})

// DELETE /api/questions/:id
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const index = questions.findIndex(q => q.id === parseInt(id));
    if (index === -1) {
        return res.status(404).json({ error: "Question not found" });
    }
    const deletedQuestion = questions.splice(index, 1)[0];
    res.json({
        message: "Question deleted successfully",
        question: deletedQuestion
    })
})


module.exports = router;