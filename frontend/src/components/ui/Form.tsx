import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import {
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
} from "react";

import { cn } from "@/lib/cn";

import styles from "./Form.module.css";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  /** A single form control; it receives the id and ARIA wiring. */
  children: ReactElement<Record<string, unknown>>;
  className?: string;
}

/** Label + control + hint + error, with ids and aria-describedby wired for screen readers. */
export function Field({ label, hint, error, optional, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
      })
    : children;
  return (
    <div className={cn(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label} {optional && <span className={styles.optional}>(optional)</span>}
      </label>
      {control}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          <AlertCircle size={14} aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(styles.control, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(styles.control, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cn(styles.control, className)} {...props} />;
});

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }>(
  function Checkbox({ label, className, ...props }, ref) {
    return (
      <label className={cn(styles.check, className)}>
        <input ref={ref} type="checkbox" {...props} />
        <span>{label}</span>
      </label>
    );
  },
);

const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info, warning: TriangleAlert };

export function Alert({ tone = "info", children }: { tone?: keyof typeof ICONS; children: ReactNode }) {
  const Icon = ICONS[tone];
  return (
    <div className={cn(styles.alert, styles[`alert-${tone}`])} role={tone === "error" ? "alert" : "status"}>
      <Icon size={18} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Hidden from people (and screen readers); bots fill it in and get silently dropped. */
export const Honeypot = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Honeypot(props, ref) {
    return (
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Leave this field empty
          <input ref={ref} type="text" tabIndex={-1} autoComplete="off" {...props} />
        </label>
      </div>
    );
  },
);
