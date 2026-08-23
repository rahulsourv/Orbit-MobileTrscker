const { AppError } = require("./error.middleware");

// Validates one request section against a Zod schema and replaces it with the
// parsed result, so controllers only ever see known, coerced fields.
const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    // express.json() leaves req.body undefined when a request carries no body,
    // which is normal for cookie-authenticated POSTs like /refresh.
    const target =
      source === "body" && req.body === undefined ? {} : req[source];

    const result = schema.safeParse(target);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || source,
        message: issue.message,
      }));

      return next(new AppError("Validation failed", 400, errors));
    }

    if (source === "body") {
      req.body = result.data;
    } else {
      req.validated = { ...(req.validated || {}), [source]: result.data };
    }

    return next();
  };

module.exports = { validate };
