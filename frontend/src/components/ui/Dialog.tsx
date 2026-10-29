import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

import { Button } from "./Button";
import styles from "./primitives.module.css";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** A modal built on the native <dialog> element (focus trapping, Esc and inert background for free). */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    // Clicking the backdrop closes the dialog for pointer users; keyboard users have Esc and the Close button.
    // eslint-disable-next-line jsx-a11y-x/click-events-have-key-events, jsx-a11y-x/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose(); // Click on the backdrop.
      }}
    >
      {open && (
        <>
          <div className={styles["dialog-header"]}>
            <h2 id={titleId}>{title}</h2>
            <Button variant="ghost" icon size="sm" aria-label="Close" onClick={onClose}>
              <X size={18} />
            </Button>
          </div>
          <div className={styles["dialog-body"]}>{children}</div>
        </>
      )}
    </dialog>
  );
}
