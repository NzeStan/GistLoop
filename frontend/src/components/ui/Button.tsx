import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";

import { cn } from "@/lib/cn";

import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "inverse";
type Size = "sm" | "md" | "lg";

interface StyleProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  /** Square, icon-only button: give it an aria-label. */
  icon?: boolean;
}

function classes({ variant = "primary", size = "md", block, icon }: StyleProps, extra?: string) {
  return cn(
    styles.button,
    styles[variant],
    size !== "md" && styles[size],
    block && styles.block,
    icon && styles.icon,
    extra,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleProps {
  loading?: boolean;
  leading?: ReactNode;
}

export function Button({
  variant,
  size,
  block,
  icon,
  loading,
  leading,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes({ variant, size, block, icon }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden /> : leading}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends LinkProps, StyleProps {
  leading?: ReactNode;
}

export function ButtonLink({ variant, size, block, icon, leading, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classes({ variant, size, block, icon }, className)} {...rest}>
      {leading}
      {children}
    </Link>
  );
}

export interface AnchorButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement>, StyleProps {
  leading?: ReactNode;
}

/** An external link (or file download) that looks like a button. */
export function AnchorButton({ variant, size, block, icon, leading, className, children, ...rest }: AnchorButtonProps) {
  return (
    <a className={classes({ variant, size, block, icon }, className)} {...rest}>
      {leading}
      {children}
    </a>
  );
}
