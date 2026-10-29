import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

import { cn } from "@/lib/cn";

import styles from "./primitives.module.css";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (message: string, tone: Toast["tone"]) => {
      const id = nextId++;
      setToasts((all) => [...all.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo(
    () => ({ success: (m: string) => push(m, "success"), error: (m: string) => push(m, "error") }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.toasts} aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(styles.toast, toast.tone === "error" && styles["toast-error"])}
            role="status"
          >
            {toast.tone === "error" ? <CircleAlert size={18} aria-hidden /> : <CheckCircle2 size={18} aria-hidden />}
            <span>{toast.message}</span>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
