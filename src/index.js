const prisma = require("./lib/prisma");
const app = require("./app");
const logger = require("./lib/logger");
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info(
    { port: PORT },
    `Server is running on port http://localhost:${PORT}`,
  );
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
