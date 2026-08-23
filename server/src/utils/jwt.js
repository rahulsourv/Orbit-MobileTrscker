const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const env = require("../config/env");

const generateAccessToken = (userId) =>
  jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    subject: String(userId),
  });

// jti keeps every issued refresh token unique even for the same user and second.
const generateRefreshToken = (userId) =>
  jwt.sign({ userId, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL,
    subject: String(userId),
  });

const verifyAccessToken = (token) => jwt.verify(token, env.JWT_SECRET);

const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
