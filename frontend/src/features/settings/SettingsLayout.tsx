import { NavLink, Outlet } from "react-router";

import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";

import styles from "./Settings.module.css";

const SECTIONS = [
  { to: "/settings", label: "Profile", end: true },
  { to: "/settings/account", label: "Account" },
  { to: "/settings/privacy", label: "Privacy" },
  { to: "/settings/notifications", label: "Notifications" },
  { to: "/settings/security", label: "Security" },
  { to: "/settings/data", label: "Your data" },
];

export default function SettingsLayout() {
  return (
    <div>
      <Seo title="Settings" noIndex />
      <PageHeader title="Settings" />
      <div className={styles.layout}>
        <nav aria-label="Settings" className={styles.nav}>
          {SECTIONS.map((s) => (
            <NavLink key={s.to} to={s.to} end={s.end} className={styles.navLink}>
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
