import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import styles from "./primitives.module.css";

type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger";

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn(styles.badge, tone !== "neutral" && styles[`badge-${tone}`], className)}>{children}</span>;
}
