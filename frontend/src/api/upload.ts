import { authFetch } from "./client";
import { toApiError } from "./errors";

/** Image types the API accepts for photos (it re-checks the real content). */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");

/** Check a picked file before uploading, so people get a clear message straight away. */
export function checkImage(file: File, maxMb: number): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Choose a JPEG, PNG or WebP image.";
  if (file.size > maxMb * 1024 * 1024) return `Choose an image under ${maxMb} MB.`;
  return null;
}

/**
 * POST a file as multipart/form-data (the browser sets the boundary), with sign-in attached.
 *
 *     const media = await uploadFile<Media>("/api/v1/social/media/", file, { alt_text: "…" });
 */
export async function uploadFile<T>(
  path: string,
  file: File,
  fields: Record<string, string> = {},
  fileField = "file",
): Promise<T> {
  const form = new FormData();
  form.append(fileField, file);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  let response: Response;
  try {
    response = await authFetch(
      new Request(new URL(path, window.location.origin), {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
      }),
    );
  } catch {
    throw toApiError(0, undefined);
  }
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (!response.ok) throw toApiError(response.status, body);
  return body as T;
}
