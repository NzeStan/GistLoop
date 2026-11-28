import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import { type MfaChallenge, completeOAuth, requestSignInCode, signInWithCode, startOAuth } from "@/api/auth";
import { api, unwrap } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { useOAuthProviders } from "@/api/queries/security";
import { useAuth } from "@/auth/AuthProvider";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/Button";
import { Alert, Field, Input } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { brand } from "@/config/brand";

import styles from "./Auth.module.css";

/** The providers' own marks, drawn inline (no third-party scripts or images). */
function ProviderMark({ provider }: { provider: string }) {
  if (provider === "google")
    return (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path
          fill="#EA4335"
          d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"
        />
        <path
          fill="#FBBC05"
          d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.1z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"
        />
      </svg>
    );
  if (provider === "github")
    return (
      <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
      </svg>
    );
  if (provider === "yahoo")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <rect width="24" height="24" rx="5" fill="#6001D2" />
        <path fill="#fff" d="M5 7h3l2 4.6L12 7h3l-4.5 9.5V20H8v-3.5zm11 0h3l-2.3 6h-2.2zm-1.6 7.5h2.4V17h-2.4z" />
      </svg>
    );
  return null;
}

/** "Continue with Google / Yahoo / GitHub" (only the ones with keys configured). */
export function SocialButtons({ next = "/feed", mode = "login" }: { next?: string; mode?: "login" | "link" }) {
  const providers = useOAuthProviders();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!providers.data?.length) return null;
  const go = async (key: string) => {
    setBusy(key);
    setError(null);
    try {
      await startOAuth(key, mode, next);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };
  return (
    <div className="stack" style={{ "--stack-gap": "var(--space-2)" } as React.CSSProperties}>
      {error && <Alert tone="error">{error}</Alert>}
      {providers.data.map((p) => (
        <Button
          key={p.key}
          type="button"
          variant="secondary"
          size="lg"
          block
          loading={busy === p.key}
          leading={<ProviderMark provider={p.key} />}
          onClick={() => void go(p.key)}
        >
          Continue with {p.name}
        </Button>
      ))}
      {mode === "login" && (
        <p className="muted" style={{ fontSize: "var(--text-xs)", textAlign: "center" }}>
          New here? Continuing creates your account and means you agree to the <Link to="/terms">Terms</Link> and{" "}
          <Link to="/privacy">Privacy Policy</Link> and are at least 16.
        </p>
      )}
      <div className={styles.divider}>
        <span>or</span>
      </div>
    </div>
  );
}

/** Record agreement to the terms after a first sign-in with Google, Yahoo or GitHub. */
async function recordConsentIfMissing() {
  try {
    const current = (await unwrap(api.GET("/api/v1/me/consents/"))) as Record<string, { granted: boolean }>;
    for (const purpose of ["terms_of_service", "privacy_policy"]) {
      if (!current[purpose]?.granted) {
        await unwrap(
          api.POST("/api/v1/me/consents/", { body: { purpose, granted: true, version: brand.legal.policiesUpdated } }),
        );
      }
    }
  } catch {
    /* Never block signing in on this. */
  }
}

/** /auth/callback/:provider: back from Google, Yahoo or GitHub. */
export function OAuthCallbackPage() {
  const { provider = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { completeMfa } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<{ challenge: MfaChallenge; next: string } | null>(null);
  const [code, setCode] = useState("");
  const ran = useRef(false);
  const denied = params.get("error");
  const shown =
    error ??
    (denied ? (denied === "access_denied" ? "You cancelled signing in." : "The provider couldn't sign you in.") : null);

  useEffect(() => {
    if (ran.current) return; // Codes are single-use: never post twice (React strict mode).
    ran.current = true;
    if (params.get("error")) return;
    completeOAuth(provider, params.get("code") ?? "", params.get("state") ?? "")
      .then(async ({ linked, next, mfa: challenge }) => {
        if (challenge) return setMfa({ challenge, next });
        if (linked) return navigate("/settings/security?linked=1", { replace: true });
        await recordConsentIfMissing();
        navigate(next, { replace: true });
      })
      .catch((e) => {
        const message = errorMessage(e);
        setError(
          /external_account_conflict|link this provider/i.test(message)
            ? "An account already uses that email. Sign in with your password, then link this provider in Settings → Security."
            : message,
        );
      });
  }, [navigate, params, provider]);

  if (mfa) {
    return (
      <div className={styles.card}>
        <Seo title="Verify it's you" noIndex />
        <h1>Check your code</h1>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            completeMfa(mfa.challenge.challenge_id, code.trim())
              .then(() => navigate(mfa.next, { replace: true }))
              .catch((err) => setError(errorMessage(err)));
          }}
        >
          {error && <Alert tone="error">{error}</Alert>}
          <Field label={`Code sent to ${mfa.challenge.destination}`}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" block>
            Verify and sign in
          </Button>
        </form>
      </div>
    );
  }
  return (
    <div className={styles.card}>
      <Seo title="Signing you in" noIndex />
      {shown ? (
        <div className="stack">
          <Alert tone="error">{shown}</Alert>
          <Link to="/login">Back to sign in</Link>
        </div>
      ) : (
        <div className="stack" style={{ alignItems: "center" }}>
          <Spinner label="Signing you in" />
          <p className="muted">Signing you in…</p>
        </div>
      )}
    </div>
  );
}

/** Sign in with a one-time code sent to your email (or phone) instead of a password. */
export function CodeSignIn({ next, onCancel }: { next: string; onCancel: () => void }) {
  const navigate = useNavigate();
  const { completeMfa } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [challenge, setChallenge] = useState<{ challenge_id: string; channel: string } | null>(null);
  const [mfa, setMfa] = useState<MfaChallenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setChallenge(await requestSignInCode(identifier.trim()));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      if (mfa) {
        await completeMfa(mfa.challenge_id, code.trim());
      } else {
        const result = await signInWithCode(challenge.challenge_id, code.trim());
        if (result.mfa) {
          setMfa(result.mfa);
          setCode("");
          return;
        }
      }
      navigate(next, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!challenge) {
    return (
      <form className="stack" onSubmit={send}>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Email address (or phone number starting with +234)">
          <Input autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </Field>
        <Button type="submit" size="lg" block loading={busy}>
          Send me a code
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Use my password instead
        </Button>
      </form>
    );
  }
  return (
    <form className="stack" onSubmit={verify}>
      <Alert tone="info">
        {mfa
          ? `Now enter the second code we sent to ${mfa.destination}.`
          : `If ${identifier} has an account, we've sent it a ${challenge.channel === "sms" ? "text" : "email"} with a code.`}
      </Alert>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Code">
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
      </Field>
      <Button type="submit" size="lg" block loading={busy}>
        Sign in
      </Button>
      <Button type="button" variant="ghost" onClick={() => (setChallenge(null), setMfa(null), setCode(""))}>
        Start again
      </Button>
    </form>
  );
}
