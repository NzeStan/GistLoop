import { Link } from "react-router";

import { useActionsAgainstMe, useFileAppeal, useMyAppeals, useMyReports } from "@/api/queries/staff";
import { ActionButton, DataTable, Section, StatusBadge } from "@/components/Manage";
import m from "@/components/Manage.module.css";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { formatDateTime, humanize } from "@/lib/format";
import { CONTENT_LABELS, contentHref } from "@/lib/links";

function What({ type, id }: { type: string; id: string }) {
  const href = contentHref(type, id);
  const label = CONTENT_LABELS[type] ?? humanize(type.split(".").pop() ?? type);
  return href ? <Link to={href}>{label}</Link> : <>{label}</>;
}

/** /settings/moderation: what you've reported, action taken on your content, and your appeals. */
export default function SafetySettings() {
  const reports = useMyReports();
  const actions = useActionsAgainstMe();
  const appeals = useMyAppeals();
  const appeal = useFileAppeal();
  return (
    <>
      <Section
        title="Decisions about your account"
        description={
          <>
            When moderators act on your posts or account, it shows here. You can appeal once per decision. See the{" "}
            <Link to="/guidelines">community guidelines</Link>.
          </>
        }
      >
        {actions.isPending ? (
          <Spinner />
        ) : actions.isError ? (
          <ErrorState error={actions.error} />
        ) : actions.data.length === 0 ? (
          <p className="muted">Nothing. Keep it up.</p>
        ) : (
          <DataTable
            caption="Decisions"
            rows={actions.data}
            rowKey={(a) => a.id}
            columns={[
              { header: "What", cell: (a) => <What type={a.content_type} id={a.object_id} /> },
              {
                header: "Decision",
                cell: (a) => (
                  <>
                    <StatusBadge status={a.reversed_at ? "cancelled" : "hidden"} label={humanize(a.action)} />
                    {a.reason && <div className={m.small}>{a.reason}</div>}
                    {a.expires_at && <div className={m.small}>Until {formatDateTime(a.expires_at)}</div>}
                  </>
                ),
              },
              { header: "When", cell: (a) => formatDateTime(a.created_at) },
              {
                header: "Appeal",
                end: true,
                cell: (a) =>
                  a.appeal_status ? (
                    <StatusBadge status={a.appeal_status} />
                  ) : a.reversed_at ? (
                    <span className={m.small}>Reversed</span>
                  ) : a.action === "dismiss" ? null : (
                    <ActionButton
                      reason="Why should we look again?"
                      run={(statement) =>
                        appeal.mutateAsync({ action_id: a.id, statement: statement || "Please review this again." })
                      }
                      success="Appeal sent. A different moderator will review it."
                    >
                      Appeal
                    </ActionButton>
                  ),
              },
            ]}
          />
        )}
      </Section>
      {appeals.data && appeals.data.length > 0 && (
        <Section title="Your appeals">
          <ul className={m.list}>
            {appeals.data.map((a) => (
              <li key={a.id} className={m.item}>
                <span>
                  <What type={a.content_type} id={a.object_id} /> · {humanize(a.action)}
                </span>
                <StatusBadge status={a.appeal_status} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section
        title="Your reports"
        description="Reports are confidential: the person you report is never told who reported them."
      >
        {reports.isPending ? (
          <Spinner />
        ) : (reports.data ?? []).length === 0 ? (
          <p className="muted">You haven't reported anything.</p>
        ) : (
          <DataTable
            caption="Reports"
            rows={reports.data!}
            rowKey={(r) => r.id}
            columns={[
              { header: "What", cell: (r) => <What type={r.content_type} id={r.object_id} /> },
              { header: "Reason", cell: (r) => humanize(r.reason) },
              {
                header: "Outcome",
                cell: (r) => (
                  <StatusBadge status={r.outcome || "pending"} label={humanize(r.outcome || "Under review")} />
                ),
              },
              { header: "When", cell: (r) => formatDateTime(r.created_at) },
            ]}
          />
        )}
      </Section>
    </>
  );
}
