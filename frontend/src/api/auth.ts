/**
 * Browser session management.
 *
 * - The refresh token never reaches JavaScript: it lives in an httpOnly, SameSite=Strict cookie
 *   that only the GistLoop API's /bff/auth/ endpoints can read.
 * - The access token (valid for 5 minutes) is kept in memory only, never in localStorage, so an
 *   XSS bug can't lift a long-lived credential.
 * - Refreshes are single-flight within a tab and serialised across tabs with the Web Locks API.
 *   University detects refresh-token reuse and ends the whole session, so two tabs refreshing at
 *   once must never send the same cookie. Tabs also share fresh access tokens over a
 *   BroadcastChannel so they rarely need to refresh at all.
 */

export interface AccessToken {
  access: string;
  expiresAt: number;
  sessionId: string;
}

export interface MfaChallenge {
  mfa_required: true;
  challenge_id: string;
  channel: string;
  destination: string;
}

interface BrowserTokens {
  token_type: string;
  access: string;
  access_expires_at: string;
  refresh_expires_at: string;
  session_id: string;
}

const CLIENT_HEADERS = { "X-GistLoop-Client": "web", "Content-Type": "application/json" };
const LOCK_NAME = "gistloop-auth-refresh";
const CHANNEL_NAME = "gistloop-auth";
/** A harmless hint (not a credential) so first-time visitors skip the silent sign-in request. */
const SIGNED_IN_HINT = "gistloop-signed-in";
/** Refresh a little early so requests never race the expiry. */
const EXPIRY_MARGIN_MS = 20_000;

let current: AccessToken | null = null;
let inFlight: Promise<boolean> | null = null;
const listeners = new Set<() => void>();
const channel: BroadcastChannel | null =
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);

type ChannelMessage = { type: "token"; token: AccessToken } | { type: "signed-out" };

function emit() {
  listeners.forEach((listener) => listener());
}

function setHint(signedIn: boolean) {
  try {
    if (signedIn) localStorage.setItem(SIGNED_IN_HINT, "1");
    else localStorage.removeItem(SIGNED_IN_HINT);
  } catch {
    /* Storage unavailable (private mode): the silent sign-in still works, just always tried. */
  }
}

function hasHint(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_HINT) === "1";
  } catch {
    return true;
  }
}

function store(tokens: BrowserTokens, broadcast = true) {
  current = {
    access: tokens.access,
    expiresAt: Date.parse(tokens.access_expires_at),
    sessionId: tokens.session_id,
  };
  setHint(true);
  if (broadcast) channel?.postMessage({ type: "token", token: current } satisfies ChannelMessage);
  emit();
}

function forget(broadcast = true) {
  const had = current !== null;
  current = null;
  setHint(false);
  if (broadcast) channel?.postMessage({ type: "signed-out" } satisfies ChannelMessage);
  if (had || broadcast) emit();
}

channel?.addEventListener("message", (event: MessageEvent<ChannelMessage>) => {
  if (event.data.type === "token") {
    current = event.data.token;
    emit();
  } else if (event.data.type === "signed-out") {
    forget(false);
  }
});

const isFresh = (token: AccessToken | null): boolean =>
  token !== null && token.expiresAt - Date.now() > EXPIRY_MARGIN_MS;

/** Subscribe to sign-in/out and token changes (for React's useSyncExternalStore). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccessToken(): AccessToken | null {
  return current;
}

export function isSignedIn(): boolean {
  return current !== null;
}

async function postBff(path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`/bff/auth/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { ...CLIENT_HEADERS, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function refreshOnce(): Promise<boolean> {
  const before = current;
  const run = async () => {
    // Another tab may have refreshed while we waited for the lock and shared its token.
    if (current !== before && isFresh(current)) return true;
    const response = await postBff("refresh/");
    if (response.ok) {
      store((await response.json()) as BrowserTokens);
      return true;
    }
    if (response.status === 401 || response.status === 403) forget();
    return false;
  };
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(LOCK_NAME, run);
  }
  return run();
}

/** Get a new access token using the httpOnly cookie. Safe to call concurrently. */
export function refreshSession(): Promise<boolean> {
  inFlight ??= refreshOnce()
    .catch(() => false)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** A usable access token, refreshing first if it's about to expire. Null when signed out. */
export async function getValidAccessToken(): Promise<string | null> {
  const token = current;
  if (token && isFresh(token)) return token.access;
  if (token === null) return null;
  if (!(await refreshSession())) return null;
  return getAccessToken()?.access ?? null;
}

/** On page load: restore the session from the cookie, if there is one. */
export async function restoreSession(): Promise<boolean> {
  if (!hasHint()) return false;
  return refreshSession();
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function authError(response: Response): Promise<AuthError> {
  let body: { error?: { code?: string; message?: string; details?: Record<string, string[]> } } = {};
  try {
    body = await response.json();
  } catch {
    /* Non-JSON error page */
  }
  if (response.status === 429) {
    return new AuthError("Too many attempts. Please wait a few minutes and try again.", 429, "rate_limited");
  }
  return new AuthError(
    body.error?.message ?? "Something went wrong. Please try again.",
    response.status,
    body.error?.code ?? "error",
    body.error?.details ?? {},
  );
}

async function completeSignIn(response: Response): Promise<{ mfa: MfaChallenge } | { mfa: null }> {
  if (response.status === 202) return { mfa: (await response.json()) as MfaChallenge };
  if (!response.ok) throw await authError(response);
  store((await response.json()) as BrowserTokens);
  return { mfa: null };
}

export async function signIn(identifier: string, password: string) {
  return completeSignIn(await postBff("login/", { identifier, password, device_name: deviceName() }));
}

export async function completeMfa(challengeId: string, code: string) {
  return completeSignIn(await postBff("login/mfa/", { challenge_id: challengeId, code, device_name: deviceName() }));
}

/** "Email me a code": no password. Always answers the same, whether or not the account exists. */
export async function requestSignInCode(identifier: string): Promise<{ challenge_id: string; channel: string }> {
  const response = await postBff("passwordless/", { identifier });
  if (!response.ok) throw await authError(response);
  return (await response.json()) as { challenge_id: string; channel: string };
}

export async function signInWithCode(challengeId: string, code: string) {
  return completeSignIn(
    await postBff("passwordless/verify/", { challenge_id: challengeId, code, device_name: deviceName() }),
  );
}

export interface OAuthProvider {
  key: string;
  name: string;
}

/** Google, Yahoo, GitHub… whichever this deployment has keys for. */
export async function oauthProviders(): Promise<OAuthProvider[]> {
  try {
    const response = await fetch("/bff/auth/oauth/providers/", { credentials: "same-origin" });
    if (!response.ok) return [];
    return ((await response.json()) as { providers: OAuthProvider[] }).providers;
  } catch {
    return [];
  }
}

const OAUTH_NEXT = "gistloop:oauth-next";

/**
 * Go to the provider's sign-in page. ``mode: "link"`` adds it to the signed-in account instead.
 * ``next`` is where to land afterwards (a path on this site).
 */
export async function startOAuth(provider: string, mode: "login" | "link" = "login", next = "/feed"): Promise<void> {
  const token = current?.access;
  const response = await postBff(
    `oauth/${provider}/start/`,
    { mode },
    token ? { Authorization: `Bearer ${token}` } : {},
  );
  if (!response.ok) throw await authError(response);
  const { authorize_url } = (await response.json()) as { authorize_url: string };
  try {
    sessionStorage.setItem(OAUTH_NEXT, next.startsWith("/") && !next.startsWith("//") ? next : "/feed");
  } catch {
    /* Private mode: we'll land on the feed. */
  }
  window.location.assign(authorize_url);
}

/** Back from the provider: finish signing in (or linking). Returns where to go next. */
export async function completeOAuth(
  provider: string,
  code: string,
  state: string,
): Promise<{ linked: boolean; next: string; mfa: MfaChallenge | null }> {
  const token = current?.access;
  const response = await postBff(
    `oauth/${provider}/complete/`,
    { code, state },
    token ? { Authorization: `Bearer ${token}` } : {},
  );
  let next = "/feed";
  try {
    next = sessionStorage.getItem(OAUTH_NEXT) || next;
    sessionStorage.removeItem(OAUTH_NEXT);
  } catch {
    /* ignore */
  }
  if (response.status === 201) return { linked: true, next, mfa: null };
  const { mfa } = await completeSignIn(response);
  return { linked: false, next, mfa };
}

/** Sign out everywhere this browser is signed in (all tabs). Never throws. */
export async function signOut(): Promise<void> {
  const token = current?.access;
  try {
    await postBff("logout/", undefined, token ? { Authorization: `Bearer ${token}` } : {});
  } catch {
    /* Offline: the local session is still cleared below. */
  }
  forget();
}

/** Called when the API says the session is gone (e.g. revoked from another device). */
export function sessionEnded(): void {
  forget();
}

function deviceName(): string {
  if (typeof navigator === "undefined") return "Web browser";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

/** Test helper: reset module state between tests. */
export function __resetAuthForTests(): void {
  current = null;
  inFlight = null;
  listeners.clear();
}
