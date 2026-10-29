import createClient from "openapi-fetch";

import { getValidAccessToken, refreshSession, sessionEnded } from "./auth";
import { ApiError, toApiError } from "./errors";
import type { paths } from "./schema";

/**
 * fetch with the in-memory access token attached. A 401 on a signed-in request triggers one
 * silent refresh (via the httpOnly cookie) and one retry; if that fails, the session has ended.
 */
export async function authFetch(input: Request): Promise<Response> {
  const retry = input.clone();
  const token = await getValidAccessToken();
  if (token) input.headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(input);
  if (response.status !== 401 || !token) return response;
  if (await refreshSession()) {
    const fresh = await getValidAccessToken();
    if (fresh) retry.headers.set("Authorization", `Bearer ${fresh}`);
    return fetch(retry);
  }
  sessionEnded();
  return response;
}

/** The typed GistLoop API client (types generated from the OpenAPI schema: `npm run api:types`). */
export const api = createClient<paths>({
  // Same origin as the website (a reverse proxy routes /api to Django). Absolute, so it also works
  // outside browsers (tests), where relative Request URLs aren't allowed.
  baseUrl: typeof window === "undefined" ? "" : window.location.origin,
  fetch: authFetch,
  headers: { Accept: "application/json" },
});

/**
 * Await an openapi-fetch call and return its data, or throw an {@link ApiError}.
 *
 *     const me = await unwrap(api.GET("/api/v1/me/"));
 */
export async function unwrap<T>(call: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await call;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw toApiError(0, undefined);
  }
  if (result.error !== undefined || !result.response.ok) {
    throw toApiError(result.response.status, result.error);
  }
  return result.data as T;
}
