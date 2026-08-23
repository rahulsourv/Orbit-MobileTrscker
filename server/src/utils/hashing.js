const crypto = require("crypto");
const argon2 = require("argon2");

const hashPassword = (password) => argon2.hash(password);

const verifyPassword = async (passwordHash, password) => {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    // A malformed or truncated hash must read as "wrong password", not a 500.
    return false;
  }
};

// Refresh tokens are high-entropy already, so a fast digest is enough here
// and keeps lookups indexable.
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// Used for device tokens and share tokens: 32 bytes of CSPRNG output, url-safe
// so it can be dropped straight into a link.
const generateSecureToken = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("base64url");

// Constant-time compare for anything secret that is compared in application
// code rather than by a database index.
const safeEqual = (a, b) => {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));

  return (
    bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB)
  );
};

module.exports = {
  hashPassword,
  verifyPassword,
  hashToken,
  generateSecureToken,
  safeEqual,
};
