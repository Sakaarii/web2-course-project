const jwt = require("jsonwebtoken");
const { UnauthorizedError, ForbiddenError } = require("../lib/errors");
const SECRET_KEY = process.env.JWT_SECRET;

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("No token provided");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = { userId: decoded.id };
    next();
  } catch (err) {
    req.log.warn({}, "Error authenicating");
    throw new ForbiddenError("Invalid or expired token");
  }
}

module.exports = authenticate;
