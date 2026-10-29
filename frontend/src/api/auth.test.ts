import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as auth from "./auth";
import { authFetch } from "./client";

const tokens = (access = "access-1") => ({
  token_type: "Bearer",
  access,
  access_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  session_id: "session-1",
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("browser session", () => {
  beforeEach(() => auth.__resetAuthForTests());
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the access token in memory and never stores credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(tokens()));
    vi.stubGlobal("fetch", fetchMock);
    await auth.signIn("ada@example.com", "a-long-password");
    expect(auth.getAccessToken()?.access).toBe("access-1");
    const stored = JSON.stringify({ ...localStorage });
    expect(stored).not.toContain("access-1");
    expect(stored).not.toContain("rt_");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/bff/auth/login/");
    expect(init.headers["X-GistLoop-Client"]).toBe("web");
    expect(init.credentials).toBe("same-origin");
  });

  it("returns the MFA challenge instead of signing in", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          json({ mfa_required: true, challenge_id: "c1", channel: "email", destination: "a***@x.com" }, 202),
        ),
    );
    const result = await auth.signIn("ada@example.com", "a-long-password");
    expect(result.mfa?.challenge_id).toBe("c1");
    expect(auth.isSignedIn()).toBe(false);
  });

  it("refreshes once however many callers ask at the same time", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json(tokens("access-2")));
    vi.stubGlobal("fetch", fetchMock);
    const results = await Promise.all([auth.refreshSession(), auth.refreshSession(), auth.refreshSession()]);
    expect(results).toEqual([true, true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // A second refresh would trip reuse detection.
    expect(auth.getAccessToken()?.access).toBe("access-2");
  });

  it("signs out locally when the refresh cookie is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(tokens())).mockResolvedValueOnce(json({}, 401)));
    await auth.signIn("ada@example.com", "a-long-password");
    expect(await auth.refreshSession()).toBe(false);
    expect(auth.isSignedIn()).toBe(false);
    expect(localStorage.getItem("gistloop-signed-in")).toBeNull();
  });

  it("skips the silent sign-in for visitors who never signed in", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await auth.restoreSession()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries a request once with a fresh token after a 401", async () => {
    const seen: (string | null)[] = [];
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
      if (typeof input === "string") return json(input.includes("refresh") ? tokens("access-2") : tokens("access-1"));
      seen.push((input as Request).headers.get("Authorization"));
      return seen.length === 1 ? json({ error: { code: "token_expired" } }, 401) : json({ ok: true });
      void init;
    });
    vi.stubGlobal("fetch", fetchMock);
    await auth.signIn("ada@example.com", "a-long-password");
    const response = await authFetch(new Request("http://localhost/api/v1/me/"));
    expect(response.status).toBe(200);
    expect(seen).toEqual(["Bearer access-1", "Bearer access-2"]);
  });

  it("signing out clears the session even when offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(json(tokens())).mockRejectedValueOnce(new TypeError("offline")),
    );
    await auth.signIn("ada@example.com", "a-long-password");
    await auth.signOut();
    expect(auth.isSignedIn()).toBe(false);
  });
});
