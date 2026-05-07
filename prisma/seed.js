const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient();
const bcrypt = require("bcrypt")

const seedQuestions = [
    {
        id: 1,
        question: "What is the capital of France?",
        keywords: ["Paris", "London", "Berlin", "Madrid"],
        answer: "Paris"
    },
    {
        id: 2,
        question: "What is the largest planet in our solar system?",
        keywords: ["Earth", "Jupiter", "Mars", "Saturn"],
        answer: "Jupiter"
    },
    {
        id: 3,
        question: "Who is the president of Finland?",
        keywords: ["Sauli Niinistö", "Sanna Marin", "Jussi Halla-aho", "Alexander Stubb"],
        answer: "Alexander Stubb"
    }
];

async function main(){
    await prisma.question.deleteMany({})
    await prisma.keyword.deleteMany({})
    await prisma.user.deleteMany({})

    const hashedPassword = await bcrypt.hash("password123", 10);
    const seedUsers = await prisma.user.create({
        data: {
            email: "user@example.com",
            username: "user1",
            password: hashedPassword
        }
    })
    
    for (const question of seedQuestions) {
        await prisma.question.create({
            data: {
                question: question.question,
                answer: question.answer,
                keywords: {
                    connectOrCreate: question.keywords.map((op)=>({
                        where: {name: op},
                        create: {name: op}
                    })),
                },
                userId: seedUsers.id
            },
        })
    }
}

console.log("Seed data insereted successfully");


main()
    .catch((e)=>{
        console.error(e)
        process.exit(1)
    })
    .finally(()=> prisma.$disconnect())