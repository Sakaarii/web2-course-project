const { resetDb, request, app } = require("./helpers");

beforeEach(resetDb);

async function getToken(email = "qu@iz.io", username = "quizzer") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, username, password: "1234" });
  return res.body.token;
}

describe("question tests", () => {
  it("returns 404 for unknown question", async () => {
    const token = await getToken();
    const res = await request(app)
      .get("/api/questions/999999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
  });

  it("returns 401 without token", async () => {
    const res = await request(app).post("/api/questions");
    expect(res.status).toBe(401);
  });

  it("returns 403 with an invalid token", async () => {
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", "Bearer not.a.real.token")
      .send({
        question: "are?",
        date: "2026-01-01",
        answer: "yes",
        keywords: ["x"],
      });
    expect(res.status).toBe(403);
  });

  it("rejects GET list without token", async () => {
    const res = await request(app).get("/api/questions");
    expect(res.status).toBe(401);
  });

  it("returns a single question by id", async () => {
    const token = await getToken();
    const created = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "2+2?",
        date: "2026-01-01",
        answer: "4",
        keywords: ["math"],
      });

    const res = await request(app)
      .get(`/api/questions/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.question).toBe("2+2?");
    expect(res.body.answer).toBe("4");
  });
});
