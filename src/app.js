const express = require("express");

const app = express();
const questionsRouter = require("./routes/questions");
const authRouter = require("./routes/auth");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");
const pinoHttp = require("pino-http");
const logger = require("./lib/logger");

const cors = require("cors");
app.use(cors());

app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url.startsWith("/uploads") },
  }),
);

app.use(express.static(path.join(__dirname, "public")));

app.use(express.json());
app.use("/api/questions", questionsRouter);
app.use("/api/auth", authRouter);

const { NotFoundError } = require("./lib/errors");

app.use((req, res) => {
  throw new NotFoundError();
});

app.use(errorHandler);
module.exports = app;
