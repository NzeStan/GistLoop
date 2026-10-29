import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, MailCheck } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import type { z } from "zod";

import { AuthError, type MfaChallenge } from "@/api/auth";
import { ApiError, errorMessage } from "@/api/errors";
import {
  useConfirmEmailChange,
  useRegister,
  useRequestPasswordReset,
  useResendVerification,
  useResetPassword,
  useVerifyEmail,
} from "@/api/queries/account";
import { useAuth } from "@/auth/AuthProvider";
import { safeNext } from "@/auth/guards";
import { Seo } from "@/components/Seo";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert, Checkbox, Field, Input } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { brand } from "@/config/brand";

import styles from "./Auth.module.css";
import { emailSchema, loginSchema, registerSchema, resetSchema } from "./schemas";

function AuthHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.header}>
      <h1>{title}</h1>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ sign in
export function LoginPage() {
  const { signIn, completeMfa } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  const onSubmit = form.handleSubmit(async ({ identifier, password }) => {
    setError(null);
    try {
      const result = await signIn(identifier, password);
      if (result.mfa) setChallenge(result.mfa);
      else navigate(next, { replace: true });
    } catch (e) {
      // Specific codes first: an unverified email is also a 401.
      setError(
        e instanceof AuthError && e.code === "email_not_verified"
          ? "Please verify your email first. Check your inbox for the link we sent."
          : e instanceof AuthError && e.code === "invalid_credentials"
            ? "That email or password isn't right. Check them and try again."
            : errorMessage(e),
      );
    }
  });

  const onMfa = async (event: FormEvent) => {
    event.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      await completeMfa(challenge.challenge_id, code.trim());
      navigate(next, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (challenge) {
    return (
      <div className={styles.card}>
        <Seo title="Verify it's you" noIndex />
        <AuthHeader title="Check your code">
          We sent a 6-digit code to <strong>{challenge.destination}</strong>.
        </AuthHeader>
        <form className="stack" onSubmit={onMfa}>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Verification code">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" block loading={busy}>
            Verify and sign in
          </Button>
          <Button variant="ghost" onClick={() => setChallenge(null)}>
            Use a different account
          </Button>
        </form>
      </div>
    );
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <div className={styles.card}>
      <Seo title="Sign in" />
      <AuthHeader title="Welcome back">Sign in to catch up on the conversation.</AuthHeader>
      <form className="stack" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Email or username" error={errors.identifier?.message}>
          <Input autoComplete="username" {...form.register("identifier")} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...form.register("password")} />
        </Field>
        <div className={styles.row}>
          <Link to="/forgot-password">Forgot your password?</Link>
        </div>
        <Button type="submit" size="lg" block loading={isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className={styles.switch}>
        New to {brand.name}?{" "}
        <Link to={`/register${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link>
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ sign up
const CONSENT_VERSION = brand.legal.policiesUpdated;

export function RegisterPage() {
  const register = useRegister();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  const onSubmit = form.handleSubmit(async ({ display_name, handle, email, password }) => {
    try {
      await register.mutateAsync({
        email,
        password,
        handle,
        display_name,
        consents: { terms_of_service: true, privacy_policy: true },
        consent_version: CONSENT_VERSION,
        device_name: "Web browser",
      });
      setSentTo(email);
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field in form.getValues()) form.setError(field as "email", { message });
        }
      }
    }
  });

  if (sentTo) return <CheckEmail email={sentTo} />;

  const { errors, isSubmitting } = form.formState;
  const generalError =
    register.error instanceof ApiError && Object.keys(register.error.fieldErrors).length === 0 ? register.error : null;
  return (
    <div className={styles.card}>
      <Seo title="Create your account" description={`Join ${brand.name}: ${brand.tagline}`} />
      <AuthHeader title={`Join ${brand.name}`}>It's free and takes less than a minute.</AuthHeader>
      <form className="stack" onSubmit={onSubmit} noValidate>
        {generalError && <Alert tone="error">{errorMessage(generalError)}</Alert>}
        <Field label="Your name" error={errors.display_name?.message}>
          <Input autoComplete="name" {...form.register("display_name")} />
        </Field>
        <Field
          label="Username"
          hint="Letters, numbers and underscores. You can change it later."
          error={errors.handle?.message}
        >
          <Input autoComplete="username" autoCapitalize="none" spellCheck={false} {...form.register("handle")} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Field
          label="Password"
          hint="At least 10 characters. A short sentence works well."
          error={errors.password?.message}
        >
          <Input type="password" autoComplete="new-password" {...form.register("password")} />
        </Field>
        <div>
          <Checkbox
            {...form.register("accept")}
            label={
              <>
                I agree to the{" "}
                <Link to="/terms" target="_blank">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" target="_blank">
                  Privacy Policy
                </Link>
                , and I'm at least 16 years old.
              </>
            }
          />
          {errors.accept && (
            <p
              role="alert"
              style={{
                color: "var(--color-danger)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                marginTop: "var(--space-1)",
              }}
            >
              {errors.accept.message}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" block loading={isSubmitting}>
          Create account
        </Button>
      </form>
      <p className={styles.switch}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}

function CheckEmail({ email }: { email: string }) {
  const resend = useResendVerification();
  return (
    <div className={styles.card}>
      <Seo title="Check your email" noIndex />
      <div className={styles.icon}>
        <MailCheck size={28} aria-hidden />
      </div>
      <AuthHeader title="Check your email">
        If <strong>{email}</strong> can be used, we've sent a link to verify it. Open it to finish setting up your
        account.
      </AuthHeader>
      {resend.isSuccess ? (
        <Alert tone="success">Sent again. It can take a minute or two to arrive.</Alert>
      ) : (
        <Button variant="secondary" block loading={resend.isPending} onClick={() => resend.mutate(email)}>
          Resend the email
        </Button>
      )}
      <p className={styles.switch}>
        Wrong address?{" "}
        <Link to="/register" reloadDocument>
          Start again
        </Link>{" "}
        · <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ password reset
export function ForgotPasswordPage() {
  const request = useRequestPasswordReset();
  const form = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });
  const onSubmit = form.handleSubmit(({ email }) => request.mutateAsync(email).catch(() => undefined));
  if (request.isSuccess) {
    return (
      <div className={styles.card}>
        <Seo title="Check your email" noIndex />
        <div className={styles.icon}>
          <MailCheck size={28} aria-hidden />
        </div>
        <AuthHeader title="Check your email">
          If an account uses that address, you'll get a link to choose a new password. It expires soon, so use it
          shortly.
        </AuthHeader>
        <ButtonLink to="/login" variant="secondary" block>
          Back to sign in
        </ButtonLink>
      </div>
    );
  }
  const { errors, isSubmitting } = form.formState;
  return (
    <div className={styles.card}>
      <Seo title="Reset your password" noIndex />
      <AuthHeader title="Forgot your password?">Enter your email and we'll send you a link to reset it.</AuthHeader>
      <form className="stack" onSubmit={onSubmit} noValidate>
        {request.isError && <Alert tone="error">{errorMessage(request.error)}</Alert>}
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Button type="submit" size="lg" block loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
      <p className={styles.switch}>
        Remembered it? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const reset = useResetPassword();
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const onSubmit = form.handleSubmit(({ new_password }) =>
    reset.mutateAsync({ uid, token, new_password }).catch(() => undefined),
  );

  if (!uid || !token) {
    return (
      <div className={styles.card}>
        <AuthHeader title="This link isn't complete">
          Open the link from your email again, or request a new one.
        </AuthHeader>
        <ButtonLink to="/forgot-password" block>
          Request a new link
        </ButtonLink>
      </div>
    );
  }
  if (reset.isSuccess) {
    return (
      <div className={styles.card}>
        <Seo title="Password updated" noIndex />
        <div className={styles.icon}>
          <CheckCircle2 size={28} aria-hidden />
        </div>
        <AuthHeader title="Password updated">
          You've been signed out everywhere else. Sign in with your new password.
        </AuthHeader>
        <ButtonLink to="/login" block size="lg">
          Sign in
        </ButtonLink>
      </div>
    );
  }
  const { errors, isSubmitting } = form.formState;
  return (
    <div className={styles.card}>
      <Seo title="Choose a new password" noIndex />
      <AuthHeader title="Choose a new password" />
      <form className="stack" onSubmit={onSubmit} noValidate>
        {reset.isError && (
          <Alert tone="error">
            {errorMessage(reset.error)} <Link to="/forgot-password">Request a new link</Link>
          </Alert>
        )}
        <Field label="New password" hint="At least 10 characters." error={errors.new_password?.message}>
          <Input type="password" autoComplete="new-password" {...form.register("new_password")} />
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...form.register("confirm")} />
        </Field>
        <Button type="submit" size="lg" block loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ email links
function TokenPage({
  title,
  run,
  success,
  successAction,
}: {
  title: string;
  run: (token: string) => Promise<unknown>;
  success: string;
  successAction: ReactNode;
}) {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | "failed">(token ? "working" : "failed");
  const [message, setMessage] = useState("This link is incomplete. Open it from your email again.");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return; // Run once, even in StrictMode (tokens are single-use).
    started.current = true;
    run(token)
      .then(() => setState("done"))
      .catch((error) => {
        setMessage(errorMessage(error));
        setState("failed");
      });
  }, [token, run]);

  return (
    <div className={styles.card}>
      <Seo title={title} noIndex />
      {state === "working" && (
        <div className="stack" style={{ alignItems: "center" }}>
          <Spinner />
          <p className="muted">Just a moment…</p>
        </div>
      )}
      {state === "done" && (
        <>
          <div className={styles.icon}>
            <CheckCircle2 size={28} aria-hidden />
          </div>
          <AuthHeader title={success} />
          {successAction}
        </>
      )}
      {state === "failed" && (
        <>
          <AuthHeader title="That link didn't work">{message}</AuthHeader>
          <ButtonLink to="/login" variant="secondary" block>
            Go to sign in
          </ButtonLink>
        </>
      )}
    </div>
  );
}

export function VerifyEmailPage() {
  const verify = useVerifyEmail();
  return (
    <TokenPage
      title="Verify your email"
      run={verify.mutateAsync}
      success="Your email is verified"
      successAction={
        <ButtonLink to="/login" block size="lg">
          Sign in to GistLoop
        </ButtonLink>
      }
    />
  );
}

export function ConfirmEmailChangePage() {
  const confirm = useConfirmEmailChange();
  return (
    <TokenPage
      title="Confirm your new email"
      run={confirm.mutateAsync}
      success="Your new email address is confirmed"
      successAction={
        <ButtonLink to="/settings/account" block size="lg">
          Back to settings
        </ButtonLink>
      }
    />
  );
}
