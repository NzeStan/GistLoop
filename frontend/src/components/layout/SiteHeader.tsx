import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { NavLink, useLocation } from "react-router";

import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { Button, ButtonLink } from "@/components/ui/Button";

import styles from "./SiteHeader.module.css";
import { ThemeToggle } from "./ThemeToggle";

export const MARKETING_NAV = [
  { to: "/features", label: "Features" },
  { to: "/communities", label: "Communities" },
  { to: "/events", label: "Events" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/podcasts", label: "Podcasts" },
  { to: "/about", label: "About" },
];

export function SiteHeader() {
  const { status } = useAuth();
  // The menu belongs to the page it was opened on, so navigating closes it (no effect needed).
  const [openOn, setOpenOn] = useState<string | null>(null);
  const { pathname } = useLocation();
  const menuId = useId();
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const actions =
    status === "signed-in" ? (
      <ButtonLink to="/feed">Open GistLoop</ButtonLink>
    ) : (
      <>
        <ButtonLink to="/login" variant="ghost">
          Sign in
        </ButtonLink>
        <ButtonLink to="/register">Join free</ButtonLink>
      </>
    );

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Logo />
        <nav aria-label="Main" className={styles.nav}>
          {MARKETING_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={styles.link}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.actions}>
          <ThemeToggle />
          <div className={styles.desktopOnly}>{actions}</div>
          <Button
            variant="ghost"
            icon
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </Button>
        </div>
      </div>
      <div id={menuId} className={styles.mobileMenu} hidden={!open}>
        <nav aria-label="Main" className="container">
          {[...MARKETING_NAV, { to: "/contact", label: "Contact" }].map((item) => (
            <NavLink key={item.to} to={item.to} className={styles.mobileLink}>
              {item.label}
            </NavLink>
          ))}
          <div className={styles.mobileActions}>{actions}</div>
        </nav>
      </div>
    </header>
  );
}
