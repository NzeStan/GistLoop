import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import styles from "./primitives.module.css";

export function Card({
  padded = true,
  interactive,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean; interactive?: boolean }) {
  return (
    <div
      className={cn(styles.card, padded && styles["card-pad"], interactive && styles["card-link"], className)}
      {...props}
    />
  );
}
