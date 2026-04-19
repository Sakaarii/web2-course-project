const express = require('express');

const app = express();
const questionsRouter = require('./routes/questions');
const prisma = require('./lib/prisma');
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/questions', questionsRouter);
app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
})

app.listen(PORT, ()=>{
    console.log(`Server is running on port http://localhost:${PORT}`);
})

process.on("SIGINT",  async() => {
    await prisma.$disconnect();
    process.exit(0);
})

process.on("SIGTERM",  async() => {
    await prisma.$disconnect();
    process.exit(0);
})