/** Building blocks for management screens: sections, tables, confirmed actions and status badges. */
import { type ReactNode, useState } from "react";

import { errorMessage } from "@/api/errors";
import { Badge } from "@/components/ui/Badge";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Alert, Field, Textarea } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { humanize } from "@/lib/format";

import styles from "./Manage.module.css";

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="cluster">{actions}</div>}
        </div>
        {children}
      </section>
    </Card>
  );
}

export interface Column<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Right-align (actions, numbers). */
  end?: boolean;
}

/** A simple table; scrolls sideways on small screens. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  caption: string;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} scope="col" style={c.end ? { textAlign: "right" } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c, i) => (
                <td key={i} style={c.end ? { textAlign: "right" } : undefined}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Loading, error and empty states around a list query. */
export function QueryList<T>({
  query,
  empty,
  children,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: T[] | undefined; refetch: () => unknown };
  empty: ReactNode;
  children: (rows: T[]) => ReactNode;
}) {
  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const rows = query.data ?? [];
  if (rows.length === 0) return typeof empty === "string" ? <p className="muted">{empty}</p> : <>{empty}</>;
  return <>{children(rows)}</>;
}

const TONES: Record<string, "success" | "warning" | "danger" | "primary" | "neutral" | "accent"> = {
  active: "success",
  approved: "success",
  verified: "success",
  published: "success",
  sent: "success",
  paid: "success",
  succeeded: "success",
  completed: "success",
  confirmed: "success",
  resolved: "success",
  live: "success",
  open: "primary",
  pending: "warning",
  pending_review: "warning",
  awaiting_user: "warning",
  requested: "warning",
  scheduled: "warning",
  processing: "warning",
  draft: "neutral",
  submitted: "warning",
  invited: "primary",
  rejected: "danger",
  declined: "danger",
  failed: "danger",
  banned: "danger",
  suspended: "danger",
  revoked: "danger",
  cancelled: "neutral",
  canceled: "neutral",
  expired: "neutral",
  archived: "neutral",
  closed: "neutral",
  hidden: "danger",
  removed: "danger",
  taken_down: "danger",
};

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return null;
  return <Badge tone={TONES[status] ?? "neutral"}>{label ?? humanize(status)}</Badge>;
}

export function KeyValues({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className={styles.kv}>
      {items
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v], i) => (
          <div key={i} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
  );
}

/**
 * A button that runs an action, optionally after a confirmation (with a reason box), and toasts the
 * result.
 */
export function ActionButton({
  run,
  confirm,
  reason,
  success,
  children,
  ...button
}: Omit<ButtonProps, "onClick"> & {
  run: (reason: string) => Promise<unknown>;
  /** Ask first: the question shown in the dialog. */
  confirm?: string;
  /** Ask for a reason: its label ("Reason (shown to the person)"). */
  reason?: string;
  success?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await run(text);
      if (success) toast.success(success);
      setOpen(false);
      setText("");
    } catch (e) {
      if (open) setError(errorMessage(e));
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const asks = Boolean(confirm || reason);
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        {...button}
        loading={busy && !open}
        onClick={() => (asks ? setOpen(true) : void go())}
      >
        {children}
      </Button>
      {asks && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title={typeof children === "string" ? children : "Are you sure?"}
        >
          <div className="stack">
            {confirm && <p>{confirm}</p>}
            {reason && (
              <Field label={reason} optional>
                <Textarea value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
              </Field>
            )}
            {error && <Alert tone="error">{error}</Alert>}
            <div className="cluster" style={{ justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={button.variant === "danger" ? "danger" : "primary"}
                loading={busy}
                onClick={() => void go()}
              >
                {children}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}

/** Shown when the signed-in person lacks the permission a page needs. */
export function NoAccess({ children }: { children?: ReactNode }) {
  return (
    <EmptyState title="You don't have access to this">
      {children ?? "Ask an administrator if you think you should."}
    </EmptyState>
  );
}
