import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

import styles from "./primitives.module.css";

export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={className}>
      <span className={styles.spinner} aria-hidden />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

export function PageLoader() {
  return (
    <div className={styles["page-loader"]}>
      <Spinner />
    </div>
  );
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  radius,
  className,
}: {
  width?: string;
  height?: string;
  radius?: string;
  className?: string;
}) {
  const style: CSSProperties = { width, height, borderRadius: radius };
  return <span className={cn(styles.skeleton, className)} style={style} aria-hidden />;
}
