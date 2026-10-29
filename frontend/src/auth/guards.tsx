import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { PageLoader } from "@/components/ui/Spinner";

import { useAuth } from "./AuthProvider";

/** Only for signed-in people; everyone else goes to sign in and comes back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <PageLoader />;
  if (status === "signed-out") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

/** Sign-in and sign-up pages: signed-in people go straight to their feed. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <PageLoader />;
  if (status === "signed-in")
    return <Navigate to={safeNext(new URLSearchParams(window.location.search).get("next"))} replace />;
  return children;
}

/** Only follow same-site paths after sign-in (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/feed"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
