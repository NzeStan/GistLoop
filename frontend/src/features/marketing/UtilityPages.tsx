import { CheckCircle2, CircleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { errorMessage } from "@/api/errors";
import { PAYMENT_PURPOSES, useVerifyPayment } from "@/api/queries/payments";
import { useNewsletterToken } from "@/api/queries/site";
import { useAuth } from "@/auth/AuthProvider";
import { Seo } from "@/components/Seo";
import { ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { brand } from "@/config/brand";

import { Centered } from "./ErrorPages";

function NewsletterTokenPage({ action }: { action: "confirm" | "unsubscribe" }) {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const run = useNewsletterToken(action);
  const [state, setState] = useState<"working" | "done" | "failed">(token ? "working" : "failed");
  const started = useRef(false);
  const { mutateAsync } = run;

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    mutateAsync(token)
      .then(() => setState("done"))
      .catch(() => setState("failed"));
  }, [token, mutateAsync]);

  return (
    <Centered>
      <Seo title={action === "confirm" ? "Confirm subscription" : "Unsubscribe"} noIndex />
      {state === "working" && <Spinner />}
      {state === "done" && (
        <>
          <CheckCircle2 size={40} aria-hidden style={{ color: "var(--color-success)" }} />
          <h1 style={{ fontSize: "var(--text-2xl)" }}>
            {action === "confirm" ? "You're in the loop!" : "You've been unsubscribed"}
          </h1>
          <p className="muted">
            {action === "confirm"
              ? "Expect the best of campus conversations in your inbox each week."
              : "You won't receive any more newsletters. Sorry to see you go."}
          </p>
          <ButtonLink to="/">Back to {brand.name}</ButtonLink>
        </>
      )}
      {state === "failed" && (
        <>
          <CircleAlert size={40} aria-hidden style={{ color: "var(--color-danger)" }} />
          <h1 style={{ fontSize: "var(--text-2xl)" }}>That link didn't work</h1>
          <p className="muted">
            {run.error ? errorMessage(run.error) : "The link is incomplete."} Try the latest email we sent you.
          </p>
          <ButtonLink to="/">Back to {brand.name}</ButtonLink>
        </>
      )}
    </Centered>
  );
}

export const NewsletterConfirmPage = () => <NewsletterTokenPage action="confirm" />;
export const NewsletterUnsubscribePage = () => <NewsletterTokenPage action="unsubscribe" />;

/** Payment providers send buyers back here after checkout. */
export function PaymentReturnPage() {
  const [params] = useSearchParams();
  const reference = params.get("reference");
  const { status: auth } = useAuth();
  const payment = useVerifyPayment(auth === "signed-in" ? reference : null);
  const purpose = payment.data ? PAYMENT_PURPOSES[payment.data.purpose] : undefined;
  const state = !reference
    ? "missing"
    : auth === "signed-out"
      ? "signin"
      : payment.isError
        ? "error"
        : !payment.data || payment.data.status === "pending"
          ? "checking"
          : payment.data.status === "succeeded"
            ? "paid"
            : "failed";

  return (
    <Centered>
      <Seo title="Payment" noIndex />
      {state === "checking" && (
        <>
          <Spinner />
          <h1 style={{ fontSize: "var(--text-2xl)" }}>Confirming your payment…</h1>
          <p className="muted">This usually takes a few seconds. Please keep this page open.</p>
        </>
      )}
      {state === "paid" && (
        <>
          <CheckCircle2 size={40} aria-hidden style={{ color: "var(--color-primary)" }} />
          <h1 style={{ fontSize: "var(--text-2xl)" }}>Payment received</h1>
          <p className="muted">
            Thanks! {payment.data?.description} is paid. Reference: <code>{reference}</code>
          </p>
          <div className="cluster" style={{ justifyContent: "center" }}>
            <ButtonLink to={purpose?.next ?? "/notifications"}>{purpose?.cta ?? "Continue"}</ButtonLink>
            <Link to="/feed">Back to the feed</Link>
          </div>
        </>
      )}
      {(state === "failed" || state === "error" || state === "missing") && (
        <>
          <CircleAlert size={40} aria-hidden style={{ color: "var(--color-danger)" }} />
          <h1 style={{ fontSize: "var(--text-2xl)" }}>
            {state === "failed" ? "The payment didn't go through" : "We couldn't confirm this payment"}
          </h1>
          <p className="muted">
            {state === "error"
              ? errorMessage(payment.error)
              : state === "missing"
                ? "This link is missing its payment reference."
                : "No money was taken. You can try again from your orders or tickets."}
            {reference && (
              <>
                {" "}
                Reference: <code>{reference}</code>
              </>
            )}
          </p>
          <div className="cluster" style={{ justifyContent: "center" }}>
            <ButtonLink to={purpose?.next ?? "/marketplace/orders"}>{purpose?.cta ?? "View your orders"}</ButtonLink>
            <Link to="/contact">Contact support</Link>
          </div>
        </>
      )}
      {state === "signin" && (
        <>
          <h1 style={{ fontSize: "var(--text-2xl)" }}>Sign in to see your payment</h1>
          <ButtonLink to={`/login?next=${encodeURIComponent(`/payments/return?reference=${reference ?? ""}`)}`}>
            Sign in
          </ButtonLink>
        </>
      )}
    </Centered>
  );
}
