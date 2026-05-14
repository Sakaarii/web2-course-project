const prisma = require("../src/lib/prisma");
const app = require("../src/app");
const request = require("supertest");

async function resetDb() {
  await prisma.attempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.user.deleteMany();
}

async function registerAndLogin(email = "ra@ndom.io", username = "bumba") {
  await request(app)
    .post("/api/auth/register")
    .send({ email, username, password: "1234" });
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "1234" });

  return res.body.token;
}

async function createPost(token, overrides = {}) {
  const res = await request(app)
    .post("/api/questions")
    .set("Authorization", `bearer ${token}`)
    .send({ question: "are?", answer: "yes" });
  return res.body;
}

module.exports = {
  resetDb,
  registerAndLogin,
  createPost,
  request,
  app,
  prisma,
};
