const connectionService = require("../services/connection.service");

const createRequest = async (req, res, next) => {
  try {
    const result = await connectionService.createRequest(req.user, req.body);

    return res.status(201).json({
      success: true,
      message: result.hasAccount
        ? "Request sent. They will see it in their Orbit app."
        : "Request created. Send them the invite link - they have no Orbit account yet.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const listConnections = async (req, res, next) => {
  try {
    const data = await connectionService.listConnections(req.user);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Public: shows only who is asking, so someone without an account can see what
// they are being invited to before signing up.
const resolveInvite = async (req, res, next) => {
  try {
    const request = await connectionService.resolveInvite(req.params.token);

    res.set("Cache-Control", "no-store, private");

    return res.status(200).json({ success: true, data: { request } });
  } catch (error) {
    return next(error);
  }
};

const acceptRequest = async (req, res, next) => {
  try {
    const connection = await connectionService.acceptRequest(
      req.user,
      req.params.connectionId,
      { deviceIds: req.body.deviceIds }
    );

    return res.status(200).json({
      success: true,
      message: "You are now sharing your location. You can stop at any time.",
      data: { connection },
    });
  } catch (error) {
    return next(error);
  }
};

const denyRequest = async (req, res, next) => {
  try {
    const connection = await connectionService.denyRequest(
      req.user,
      req.params.connectionId
    );

    return res.status(200).json({
      success: true,
      message: "Request declined. Nothing was shared.",
      data: { connection },
    });
  } catch (error) {
    return next(error);
  }
};

const revokeConnection = async (req, res, next) => {
  try {
    await connectionService.revokeConnection(req.user, req.params.connectionId);

    return res.status(200).json({
      success: true,
      message: "Sharing stopped",
    });
  } catch (error) {
    return next(error);
  }
};

const updateSharedDevices = async (req, res, next) => {
  try {
    const connection = await connectionService.updateSharedDevices(
      req.user,
      req.params.connectionId,
      req.body.deviceIds
    );

    return res.status(200).json({ success: true, data: { connection } });
  } catch (error) {
    return next(error);
  }
};

const listSharedDevices = async (req, res, next) => {
  try {
    const devices = await connectionService.listSharedDevices(req.user);

    return res.status(200).json({ success: true, data: { devices } });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createRequest,
  listConnections,
  resolveInvite,
  acceptRequest,
  denyRequest,
  revokeConnection,
  updateSharedDevices,
  listSharedDevices,
};
