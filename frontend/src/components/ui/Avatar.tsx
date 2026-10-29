import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

import styles from "./primitives.module.css";

/** A stable, pleasant colour per person, derived from their id. */
function hue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

interface AvatarProps {
  name: string | null | undefined;
  seed?: string;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Avatar({ name, seed, src, size = "md", className }: AvatarProps) {
  const h = hue(seed ?? name ?? "gistloop");
  return (
    <span
      className={cn(styles.avatar, size !== "md" && styles[`avatar-${size}`], className)}
      style={{ background: `linear-gradient(135deg, oklch(0.62 0.17 ${h}), oklch(0.52 0.2 ${(h + 40) % 360}))` }}
      aria-hidden={!src}
    >
      {src ? <img src={src} alt={name ?? ""} loading="lazy" /> : initials(name)}
    </span>
  );
}
