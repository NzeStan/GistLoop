import { CircleAlert, Compass } from "lucide-react";
import type { ReactNode } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";

import { Seo } from "@/components/Seo";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { brand } from "@/config/brand";

export function Centered({ children }: { children: ReactNode }) {
  return (
    <section className="section">
      <div className="container-narrow" style={{ textAlign: "center" }}>
        <Card style={{ padding: "var(--space-12) var(--space-6)" }}>
          <div className="stack" style={{ alignItems: "center" }}>
            {children}
          </div>
        </Card>
      </div>
    </section>
  );
}

export function NotFoundPage() {
  return (
    <Centered>
      <Seo title="Page not found" noIndex />
      <Compass size={40} aria-hidden style={{ color: "var(--color-primary)" }} />
      <h1 style={{ fontSize: "var(--text-3xl)" }}>This conversation has moved on</h1>
      <p className="muted">We couldn't find that page. It may have been deleted, or the link may be wrong.</p>
      <div className="cluster" style={{ justifyContent: "center" }}>
        <ButtonLink to="/">Go home</ButtonLink>
        <ButtonLink to="/help" variant="secondary">
          Visit the help centre
        </ButtonLink>
      </div>
    </Centered>
  );
}

/** Shown if a page crashes or fails to load (e.g. after a new deploy). */
export function RouteErrorPage() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (notFound) return <NotFoundPage />;
  const chunkFailed = error instanceof Error && /dynamically imported module|Failed to fetch/i.test(error.message);
  return (
    <main id="main" style={{ flex: 1 }}>
      <Centered>
        <Seo title="Something went wrong" noIndex />
        <CircleAlert size={40} aria-hidden style={{ color: "var(--color-danger)" }} />
        <h1 style={{ fontSize: "var(--text-3xl)" }}>
          {chunkFailed ? `${brand.name} was updated` : "Something went wrong"}
        </h1>
        <p className="muted">
          {chunkFailed
            ? "Reload the page to get the latest version."
            : "Sorry about that. Try reloading the page; if it keeps happening, let us know."}
        </p>
        <div className="cluster" style={{ justifyContent: "center" }}>
          <ButtonLink to="." reloadDocument>
            Reload
          </ButtonLink>
          <ButtonLink to="/" variant="secondary" reloadDocument>
            Go home
          </ButtonLink>
        </div>
      </Centered>
    </main>
  );
}
