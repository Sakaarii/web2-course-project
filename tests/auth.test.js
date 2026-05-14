const { resetDb } = require("./helpers");
const request = require("supertest");

const app = require("../src/app");
const prisma = require("../src/lib/prisma");
const bcrypt = require("bcrypt");

beforeEach(resetDb);

it("registers, hashes password and returns token", async () => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email: "ra@ndom.io", username: "bumba", password: "1234" });

  expect(res.status).toBe(201);
  expect(res.body.token).toEqual(expect.any(String));
  const user = await prisma.user.findUnique({ where: { email: "ra@ndom.io" } });

  expect(user.password).not.toBe("1234");
  const comparison = await bcrypt.compare("1234", user.password);
  expect(comparison).toBe(true);
});

it("logs in an existing user and returns a token", async () => {
  await request(app)
    .post("/api/auth/register")
    .send({ email: "lo@gin.io", username: "loginer", password: "1234" });

  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "lo@gin.io", password: "1234" });

  expect(res.status).toBe(200);
  expect(res.body.token).toEqual(expect.any(String));
});

it("issues a valid JWT on register that authenticates protected routes", async () => {
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ email: "tok@en.io", username: "tokener", password: "1234" });

  const res = await request(app)
    .get("/api/questions")
    .set("Authorization", `Bearer ${reg.body.token}`);

  expect(res.status).toBe(200);
});

it("issues a valid JWT on login that authenticates protected routes", async () => {
  await request(app)
    .post("/api/auth/register")
    .send({ email: "tok2@en.io", username: "tokener2", password: "1234" });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "tok2@en.io", password: "1234" });

  const res = await request(app)
    .get("/api/questions")
    .set("Authorization", `Bearer ${login.body.token}`);

  expect(res.status).toBe(200);
});
