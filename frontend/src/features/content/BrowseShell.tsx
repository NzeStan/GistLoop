import type { ReactNode } from "react";

import { useAuth } from "@/auth/AuthProvider";
import { PageHeader, PageHero } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui/Button";

interface BrowseShellProps {
  eyebrow: string;
  title: string;
  appTitle?: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Browse pages (communities, events, marketplace, podcasts) are public. Visitors see a marketing
 * hero with a call to action; signed-in people see a compact header inside the app.
 */
export function BrowseShell({ eyebrow, title, appTitle, description, actions, children }: BrowseShellProps) {
  const { status } = useAuth();
  if (status === "signed-in") {
    return (
      <>
        <PageHeader title={appTitle ?? eyebrow} description={description} actions={actions} />
        {children}
      </>
    );
  }
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={description}>
        <ButtonLink to="/register" size="lg">
          Join GistLoop free
        </ButtonLink>
      </PageHero>
      <div className="container" style={{ paddingBlock: "var(--space-8) var(--space-16)" }}>
        {children}
      </div>
    </>
  );
}
