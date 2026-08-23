const env = require("../config/env");

class AppError extends Error {
  constructor(message, statusCode = 400, errors = undefined) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
  }
}

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Something went wrong";
  let errors = err.errors;

  if (err.name === "ValidationError" && err.errors) {
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values(err.errors).map((issue) => ({
      field: issue.path,
      message: issue.message,
    }));
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = "Resource already exists";
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid identifier";
  }

  if (statusCode >= 500) {
    // Log the request line and stack only - never headers, body or cookies,
    // any of which may carry passwords or tokens.
    console.error(
      `[error] ${req.method} ${req.originalUrl} -> ${statusCode}`,
      err.stack
    );
  }

  const body = { success: false, message };

  if (errors) {
    body.errors = errors;
  }

  if (!env.isProduction && statusCode >= 500) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};

module.exports = { AppError, notFound, errorHandler };
