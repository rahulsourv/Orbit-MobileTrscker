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

  if (!stored.isActive()) {
    /**
     * Only a *rotated* token being presented again is evidence of theft.
     *
     * replacedByTokenHash is set exactly when rotation swapped this token for
     * a newer one, so seeing it again means two parties hold the same token and
     * every session should go.
     *
     * A token revoked without a replacement was retired deliberately - a
     * logout, a sign-out-everywhere, a password change. Treating that as a
     * breach was actively harmful: after changing your password, the first
     * stale client to retry would revoke the brand-new session you were still
     * using, logging you out of the very client that made the change.
     */
    if (stored.replacedByTokenHash) {
      await RefreshToken.updateMany(
        { userId: stored.userId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );

      throw new AppError("Refresh token has been revoked", 401);
    }

    throw new AppError("Invalid or expired refresh token", 401);
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

const updateProfile = async (userId, { name }) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("Account not found", 404);
  }

  if (name !== undefined) {
    user.name = name;
  }

  await user.save();

  return toPublicUser(user);
};

/**
 * Changing a password.
 *
 * The current password is required even though the caller already holds a
 * valid session: it is what stops a borrowed, unlocked device from silently
 * taking the account away from its owner.
 *
 * Every existing session is then revoked, because the usual reason to change a
 * password is that someone else might know the old one - leaving their session
 * alive would defeat the whole exercise. A fresh pair is issued so the client
 * doing the changing stays signed in.
 */
const changePassword = async (userId, { currentPassword, newPassword }, context = {}) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("Account not found", 404);
  }

  const valid = await verifyPassword(user.passwordHash, currentPassword);

  if (!valid) {
    throw new AppError("Your current password is incorrect", 401);
  }

  if (await verifyPassword(user.passwordHash, newPassword)) {
    throw new AppError("Your new password must be different", 400);
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  await RefreshToken.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  const { accessToken, refreshToken } = await issueTokens(user, context);

  require("./notification.service").createNotification({
    userId: user._id,
    type: "NEW_LOGIN",
    title: "Your password was changed",
    message:
      "Every other session was signed out. If this was not you, change it again immediately.",
  });

  return { user: toPublicUser(user), accessToken, refreshToken };
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
  updateProfile,
  changePassword,
  toPublicUser,
};
