const locationService = require("../services/location.service");

// Written by the device, using the device token. req.device was resolved from
// that token, so the location can only ever be attributed to the device that
// actually sent it.
const recordLocation = async (req, res, next) => {
  try {
    const location = await locationService.recordLocation(req.device, req.body);

    return res.status(201).json({ success: true, data: { location } });
  } catch (error) {
    return next(error);
  }
};

// Offline sync endpoint. Returns per-item counts so the client knows exactly
// which part of its local queue it may now discard.
const recordLocationBatch = async (req, res, next) => {
  try {
    const result = await locationService.recordLocationBatch(
      req.device,
      req.body.locations
    );

    return res.status(201).json({
      success: true,
      message: `Synced ${result.accepted} location(s)`,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const { from, to, limit, before } = req.validated?.query || {};

    const result = await locationService.getHistory(
      req.user.id,
      req.params.deviceId,
      { from, to, limit, before }
    );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getLatest = async (req, res, next) => {
  try {
    const location = await locationService.getLatestLocation(
      req.user.id,
      req.params.deviceId
    );

    return res.status(200).json({ success: true, data: { location } });
  } catch (error) {
    return next(error);
  }
};

// Everything the live map needs for its first render.
const getLiveSnapshot = async (req, res, next) => {
  try {
    const devices = await locationService.getLiveSnapshot(req.user.id);

    return res.status(200).json({ success: true, data: { devices } });
  } catch (error) {
    return next(error);
  }
};

const findNearby = async (req, res, next) => {
  try {
    const devices = await locationService.findDevicesNear(
      req.user.id,
      req.validated.query
    );

    return res.status(200).json({ success: true, data: { devices } });
  } catch (error) {
    return next(error);
  }
};

const deleteHistory = async (req, res, next) => {
  try {
    const result = await locationService.deleteHistory(
      req.user.id,
      req.params.deviceId,
      req.validated?.query || {}
    );

    return res.status(200).json({
      success: true,
      message: `Deleted ${result.deleted} location record(s)`,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  recordLocation,
  recordLocationBatch,
  getHistory,
  getLatest,
  getLiveSnapshot,
  findNearby,
  deleteHistory,
};
