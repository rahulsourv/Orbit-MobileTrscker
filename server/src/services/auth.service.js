const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const { AppError } = require("../middleware/error.middleware");
const { hashPassword, verifyPassword, hashToken } = require("../utils/hashing");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");

const normalizeEmail = (email) => email.toLowerCase().trim();

const toPublicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
});

// Issues a new pair and records the refresh token hash as an active session.
const issueTokens = async (user, context = {}) => {
  const userId = user._id.toString();
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);
  const { exp } = verifyRefreshToken(refreshToken);

  const session = await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(exp * 1000),
    userAgent: context.userAgent || null,
    ip: context.ip || null,
  });

  return { accessToken, refreshToken, session };
};

const registerUser = async ({ name, email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new AppError("An account with this email already exists", 409);
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
    });

    return toPublicUser(user);
  } catch (error) {
    // Unique index caught a duplicate created between the check and the write.
    if (error.code === 11000) {
      throw new AppError("An account with this email already exists", 409);
    }

    throw error;
  }
};

const loginUser = async ({ email, password }, context = {}) => {
  const user = await User.findOne({ email: normalizeEmail(email) });

  // Same message and status whether the email is unknown or the password is
  // wrong, so the response cannot be used to enumerate accounts.
  const invalidCredentials = new AppError("Invalid email or password", 401);

  if (!user) {
    // Spend comparable time on a dummy verify to blunt timing analysis.
    await verifyPassword("$argon2id$v=19$m=65536,t=3,p=4$invalid$invalid", password);
    throw invalidCredentials;
  }

  const passwordValid = await verifyPassword(user.passwordHash, password);

  if (!passwordValid) {
    throw invalidCredentials;
  }

  const { accessToken, refreshToken } = await issueTokens(user, context);

  // Told after the fact, so an unexpected entry here is the user's cue that
  // someone else has their password. Required lazily because the notification
  // service reaches back into sockets, which authenticate through this module.
  require("./notification.service").createNotification({
    userId: user._id,
    type: "NEW_LOGIN",
    title: "New login to your Orbit account",
    message: context.userAgent
      ? `A new sign-in was recorded from ${context.userAgent.slice(0, 80)}.`
      : "A new sign-in to your account was recorded.",
  });

  return { user: toPublicUser(user), accessToken, refreshToken };
};

const rotateRefreshToken = async (rawToken, context = {}) => {
  if (!rawToken) {
    throw new AppError("Refresh token is required", 401);
  }

  let payload;

  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const tokenHash = hashToken(rawToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  // A correctly signed token that was already rotated or revoked suggests the
  // token leaked, so every session for that user is dropped.
  if (!stored.isActive()) {
    await RefreshToken.updateMany(
      { userId: stored.userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    throw new AppError("Refresh token has been revoked", 401);
  }

  const user = await User.findById(payload.userId);

  if (!user) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const issued = await issueTokens(user, context);

  stored.revokedAt = new Date();
  stored.replacedByTokenHash = issued.session.tokenHash;
  await stored.save();

  return {
    user: toPublicUser(user),
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
  };
};

// Logout is best-effort: an unknown or expired token still ends as a success
// so clients can always clear their local state.
const logoutUser = async (rawToken) => {
  if (!rawToken) {
    return { revoked: false };
  }

  const result = await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return { revoked: result.modifiedCount > 0 };
};

const revokeAllSessions = async (userId) => {
  const result = await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return { revoked: result.modifiedCount };
};

// Lets the user see where they are signed in. The token hash is never part of
// the response - only the metadata recorded alongside it.
const listSessions = async (userId) => {
  const sessions = await RefreshToken.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  return sessions.map((session) => ({
    id: session._id.toString(),
    userAgent: session.userAgent,
    ip: session.ip,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  }));
};

module.exports = {
  registerUser,
  loginUser,
  rotateRefreshToken,
  logoutUser,
  revokeAllSessions,
  listSessions,
  toPublicUser,
};
