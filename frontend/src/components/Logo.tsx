import { Link } from "react-router";

import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

import styles from "./Logo.module.css";

/**
 * The brand logo from src/config/brand.ts. If the image can't load (e.g. the CDN isn't set up
 * yet), a styled wordmark takes its place so the header never looks broken.
 */
export function Logo({ to = "/", onDark = false, className }: { to?: string; onDark?: boolean; className?: string }) {
  return (
    <Link to={to} className={cn(styles.logo, className)} aria-label={`${brand.name} home`}>
      <img
        src={onDark ? brand.assets.logoOnDark : brand.assets.logo}
        alt=""
        width={140}
        height={37}
        className={styles.image}
        onError={(event) => {
          event.currentTarget.hidden = true;
          event.currentTarget.nextElementSibling?.removeAttribute("hidden");
        }}
      />
      <span className={cn(styles.wordmark, onDark && styles.onDark)} hidden>
        <span className={styles.mark} aria-hidden>
          ●
        </span>
        {brand.name}
      </span>
    </Link>
  );
}
