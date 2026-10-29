import { CloudOff, type LucideIcon, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { errorMessage } from "@/api/errors";

import { Button } from "./Button";
import styles from "./primitives.module.css";

export function EmptyState({
  icon: Icon = Sparkles,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.state}>
      <span className={styles["state-icon"]}>
        <Icon size={26} aria-hidden />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className={styles.state} role="alert">
      <span className={styles["state-icon"]}>
        <CloudOff size={26} aria-hidden />
      </span>
      <h3>We couldn't load this</h3>
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
