const env = require("../config/env");
const authService = require("../services/auth.service");
const { verifyRefreshToken } = require("../utils/jwt");

// Web clients get the refresh token as an HttpOnly cookie and never see it in
// the body. Native clients ask for it explicitly and store it in SecureStore.
const wantsTokenInBody = (req) =>
  String(req.get("x-client-type") || "").toLowerCase() === "mobile";

const readRefreshToken = (req) =>
  req.cookies?.[env.refreshCookie.name] || req.body?.refreshToken || null;

const setRefreshCookie = (res, token, expiresAt) => {
  res.cookie(env.refreshCookie.name, token, {
    httpOnly: env.refreshCookie.httpOnly,
    secure: env.refreshCookie.secure,
    sameSite: env.refreshCookie.sameSite,
    path: env.refreshCookie.path,
    expires: expiresAt,
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(env.refreshCookie.name, {
    httpOnly: env.refreshCookie.httpOnly,
    secure: env.refreshCookie.secure,
    sameSite: env.refreshCookie.sameSite,
    path: env.refreshCookie.path,
  });
};

const requestContext = (req) => ({
  userAgent: req.get("user-agent") || null,
  ip: req.ip || null,
});

const sendSession = (req, res, statusCode, { user, accessToken, refreshToken }) => {
  const data = { user, accessToken };

  if (wantsTokenInBody(req)) {
    data.refreshToken = refreshToken;
  } else {
    const { exp } = verifyRefreshToken(refreshToken);
    setRefreshCookie(res, refreshToken, new Date(exp * 1000));
  }

  return res.status(statusCode).json({ success: true, data });
};

const register = async (req, res, next) => {
  try {
    const user = await authService.registerUser(req.body);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const session = await authService.loginUser(req.body, requestContext(req));

    return sendSession(req, res, 200, session);
  } catch (error) {
    return next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const session = await authService.rotateRefreshToken(
      readRefreshToken(req),
      requestContext(req)
    );

    return sendSession(req, res, 200, session);
  } catch (error) {
    clearRefreshCookie(res);
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logoutUser(readRefreshToken(req));
    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return next(error);
  }
};

const logoutAll = async (req, res, next) => {
  try {
    const result = await authService.revokeAllSessions(req.user.id);
    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: "Signed out of all sessions",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const listSessions = async (req, res, next) => {
  try {
    const sessions = await authService.listSessions(req.user.id);

    return res.status(200).json({ success: true, data: { sessions } });
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res) =>
  res.status(200).json({ success: true, data: { user: req.user } });

module.exports = { register, login, refresh, logout, logoutAll, listSessions, me };
