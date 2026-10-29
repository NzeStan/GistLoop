import { authFetch } from "./client";
import { toApiError } from "./errors";

type Query = Record<string, string | number | boolean | undefined | null>;

/**
 * For the few endpoints whose OpenAPI description is incomplete (free-form or cursor-paginated
 * responses). Everything else should use the typed `api` client.
 */
export async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options: { query?: Query; body?: unknown } = {},
): Promise<T> {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const init: RequestInit = { method, headers: { Accept: "application/json" } };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  let response: Response;
  try {
    response = await authFetch(new Request(url, init));
  } catch {
    throw toApiError(0, undefined);
  }
  const text = await response.text();
  const body: unknown = text ? safeJson(text) : undefined;
  if (!response.ok) throw toApiError(response.status, body);
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
