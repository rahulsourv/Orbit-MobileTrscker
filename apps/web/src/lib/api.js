/**
 * The single door to the Orbit API.
 *
 * The access token lives in memory only - never localStorage, which any XSS
 * could read. It is lost on refresh by design; the session is rebuilt from the
 * HttpOnly refresh cookie instead, which JavaScript cannot touch.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

let accessToken = null;

// Set by the auth store so a failed refresh can tear the session down from
// anywhere, including a background request.
let onSessionExpired = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    // Field-level validation problems, shaped [{ field, message }].
    this.errors = errors;
  }

  fieldError(field) {
    return this.errors?.find((issue) => issue.field === field)?.message || null;
  }
}

// Concurrent 401s must not each fire their own refresh: the first rotation
// would invalidate the token the others are still holding, and the backend
// would read that as a stolen token and kill every session. One refresh is
// shared by everyone waiting.
let refreshInFlight = null;

const refreshSession = () => {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new ApiError(
            payload?.message || "Session expired",
            response.status
          );
        }

        accessToken = payload.data.accessToken;

        return payload.data;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
};

const send = async (path, { method = "GET", body, signal, retry = true } = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    signal,
    // Always included so the refresh cookie rides along on /auth routes.
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 and friends have nothing to parse.
  const payload =
    response.status === 204 ? null : await response.json().catch(() => null);

  if (response.ok) {
    return payload?.data ?? payload;
  }

  // An expired access token is routine, not an error the caller should see:
  // refresh once, then replay the original request.
  if (response.status === 401 && retry && path !== "/auth/refresh") {
    try {
      await refreshSession();

      return await send(path, { method, body, signal, retry: false });
    } catch {
      accessToken = null;
      onSessionExpired?.();

      throw new ApiError(
        payload?.message || "Your session has expired",
        401,
        payload?.errors
      );
    }
  }

  throw new ApiError(
    payload?.message || "Something went wrong",
    response.status,
    payload?.errors
  );
};

export const api = {
  get: (path, options) => send(path, { ...options, method: "GET" }),
  post: (path, body, options) => send(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => send(path, { ...options, method: "PATCH", body }),
  put: (path, body, options) => send(path, { ...options, method: "PUT", body }),
  delete: (path, options) => send(path, { ...options, method: "DELETE" }),
  refreshSession,
};
