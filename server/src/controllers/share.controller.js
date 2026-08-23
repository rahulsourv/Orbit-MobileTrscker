const shareService = require("../services/share.service");

const createShare = async (req, res, next) => {
  try {
    const { share, token } = await shareService.createShare(req.user.id, req.body);

    return res.status(201).json({
      success: true,
      message: "Share link created. The token is shown only once.",
      data: { share, token },
    });
  } catch (error) {
    return next(error);
  }
};

const listShares = async (req, res, next) => {
  try {
    const shares = await shareService.listShares(
      req.user.id,
      req.validated?.query || {}
    );

    return res.status(200).json({ success: true, data: { shares } });
  } catch (error) {
    return next(error);
  }
};

const revokeShare = async (req, res, next) => {
  try {
    const share = await shareService.revokeShare(req.user.id, req.params.shareId);

    return res.status(200).json({
      success: true,
      message: "Share link revoked",
      data: { share },
    });
  } catch (error) {
    return next(error);
  }
};

// Public: no authentication, and deliberately the thinnest possible payload.
const resolveShare = async (req, res, next) => {
  try {
    const share = await shareService.resolveShare(req.params.token);

    // Never let a share response sit in a shared cache.
    res.set("Cache-Control", "no-store, private");

    return res.status(200).json({ success: true, data: { share } });
  } catch (error) {
    return next(error);
  }
};

module.exports = { createShare, listShares, revokeShare, resolveShare };
