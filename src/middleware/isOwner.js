const prisma = require("../lib/prisma");


async function isOwner(req, res, next) {
    const id = Number(req.params.id);
    const question = await prisma.quesitions.findUnique({
        where: { id },
        include: {options: true}
    });

    if (!question) {
        return res.status(404).json({ error: "Question not found" });
    }

    if (question.userId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden: You do not have permission to modify this question" });
    }

    req.question = question;
    next();

}

module.exports = isOwner;
