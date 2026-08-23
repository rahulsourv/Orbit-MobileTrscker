const { AppError } = require("./error.middleware");
const { verifyAccessToken } = require("../utils/jwt");
const User = require("../models/User");

// Populates req.user from a verified access token. Downstream code must use
// req.user.id and never a client-supplied user id.
const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      throw new AppError("Authentication required", 401);
    }

    const token = header.slice(7).trim();

    if (!token) {
      throw new AppError("Authentication required", 401);
    }

    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      const message =
        error.name === "TokenExpiredError"
          ? "Access token expired"
          : "Invalid access token";

      throw new AppError(message, 401);
    }

    const user = await User.findById(payload.userId).select("-passwordHash");

    if (!user) {
      throw new AppError("Invalid access token", 401);
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { requireAuth };
