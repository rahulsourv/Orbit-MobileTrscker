const geofenceService = require("../services/geofence.service");

const createGeofence = async (req, res, next) => {
  try {
    const geofence = await geofenceService.createGeofence(req.user.id, req.body);

    return res.status(201).json({ success: true, data: { geofence } });
  } catch (error) {
    return next(error);
  }
};

const listGeofences = async (req, res, next) => {
  try {
    const geofences = await geofenceService.listGeofences(req.user.id);

    return res.status(200).json({ success: true, data: { geofences } });
  } catch (error) {
    return next(error);
  }
};

const getGeofence = async (req, res, next) => {
  try {
    const geofence = await geofenceService.getGeofence(
      req.user.id,
      req.params.geofenceId
    );

    return res.status(200).json({ success: true, data: { geofence } });
  } catch (error) {
    return next(error);
  }
};

const updateGeofence = async (req, res, next) => {
  try {
    const geofence = await geofenceService.updateGeofence(
      req.user.id,
      req.params.geofenceId,
      req.body
    );

    return res.status(200).json({ success: true, data: { geofence } });
  } catch (error) {
    return next(error);
  }
};

const deleteGeofence = async (req, res, next) => {
  try {
    await geofenceService.deleteGeofence(req.user.id, req.params.geofenceId);

    return res.status(200).json({ success: true, message: "Geofence deleted" });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createGeofence,
  listGeofences,
  getGeofence,
  updateGeofence,
  deleteGeofence,
};
