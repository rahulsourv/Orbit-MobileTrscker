const routeService = require("../services/route.service");

const getDirections = async (req, res, next) => {
  try {
    const { fromLat, fromLng, toLat, toLng, mode } = req.validated.query;

    const route = await routeService.getDirections({
      from: { latitude: fromLat, longitude: fromLng },
      to: { latitude: toLat, longitude: toLng },
      mode,
    });

    return res.status(200).json({ success: true, data: { route } });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getDirections };
