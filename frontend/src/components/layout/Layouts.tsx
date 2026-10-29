import { Suspense } from "react";
import { Outlet, ScrollRestoration } from "react-router";

import { Logo } from "@/components/Logo";
import { PageLoader } from "@/components/ui/Spinner";
import { brand } from "@/config/brand";

import styles from "./Layouts.module.css";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function SkipLink() {
  return (
    <a href="#main" className={styles.skip}>
      Skip to content
    </a>
  );
}

/** Root: scroll restoration and the skip link for every page. */
export function RootLayout() {
  return (
    <>
      <SkipLink />
      <Outlet />
      <ScrollRestoration />
    </>
  );
}

/** Public pages: marketing header and footer. */
export function MarketingLayout() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className={styles.main}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

/** Sign in, sign up and other account flows. */
export function AuthLayout() {
  return (
    <div className={styles.auth}>
      <aside className={styles.authBrand}>
        <Logo onDark />
        <div>
          <p className={styles.authTagline}>{brand.tagline}</p>
          <p className={styles.authCopy}>
            Join the conversations shaping campus life: communities, events, anonymous gist and more.
          </p>
        </div>
        <p className={styles.authFoot}>
          © {new Date().getFullYear()} {brand.legal.companyName}
        </p>
      </aside>
      <main id="main" tabIndex={-1} className={styles.authMain}>
        <div className={styles.authMobileLogo}>
          <Logo />
        </div>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
