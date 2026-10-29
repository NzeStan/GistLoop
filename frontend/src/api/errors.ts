/** Errors from the GistLoop API, which always answers `{"error": {code, message, details}}`. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: Record<string, unknown> = {},
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field-level messages for forms: {"email": "Enter a valid email address."}. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [field, value] of Object.entries(this.details)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (typeof first === "string") out[field] = first;
    }
    return out;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: Record<string, unknown>; request_id?: string };
}

const FRIENDLY: Record<number, string> = {
  0: "You appear to be offline. Check your connection and try again.",
  401: "Please sign in to continue.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  429: "You're doing that a little too often. Please wait a moment and try again.",
  500: "Something went wrong on our side. Please try again shortly.",
  503: "GistLoop is briefly unavailable. Please try again shortly.",
};

export function toApiError(status: number, body: unknown): ApiError {
  const error = (body as ErrorBody | undefined)?.error;
  const fallback = FRIENDLY[status] ?? (status >= 500 ? FRIENDLY[500]! : "That didn't work. Please try again.");
  const message = status === 429 || status >= 500 ? fallback : (error?.message ?? fallback);
  return new ApiError(message, status, error?.code ?? `http_${status}`, error?.details ?? {}, error?.request_id);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.name === "AuthError") return error.message;
  if (error instanceof TypeError) return FRIENDLY[0]!;
  return "Something went wrong. Please try again.";
}
