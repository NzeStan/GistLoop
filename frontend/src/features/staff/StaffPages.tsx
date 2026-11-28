import { ShieldAlert } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";

import { errorMessage } from "@/api/errors";
import { useQuery } from "@tanstack/react-query";

import { request } from "@/api/http";
import { type AnalyticsReport, type Range, usePlatformAnalytics } from "@/api/queries/analytics";
import {
  useAccountsToConfirm,
  useConfirmAccount,
  useCreator,
  useCreatorVerificationQueue,
  useRevokeCreatorVerification,
  useDecideCreatorVerification,
} from "@/api/queries/creator";
import { TYPE_LABELS, can, useCreateInstitution, usePermissions } from "@/api/queries/institutions";
import {
  type CaseSummary,
  type ModerationActionName,
  fetchRevealedIdentity,
  useAccountAction,
  useAllPermissions,
  useAppealQueue,
  useAssignCase,
  useAssignRole,
  useAuditLog,
  useCase,
  useCases,
  useDecideAppeal,
  useDecideReveal,
  useLiftRestriction,
  usePromotionQueue,
  useRequestReveal,
  useRestrictions,
  useReviewPromotion,
  useRevealRequests,
  useRevokeRole,
  useRoleAssignments,
  useRoles,
  useRules,
  useSaveRole,
  useSocialAction,
  useSocialChannels,
  useSocialQueue,
  useTakeAction,
  useUpdateRule,
  useUserByHandle,
} from "@/api/queries/staff";
import {
  useDecidePayout,
  useDisputes,
  usePayment,
  usePayoutQueue,
  useRefund,
  useRefunds,
  useResolveDispute,
} from "@/api/queries/wallet";
import { AnalyticsReportView, RangePicker } from "@/components/AnalyticsReport";
import { ActionButton, DataTable, KeyValues, NoAccess, Section, StatusBadge } from "@/components/Manage";
import m from "@/components/Manage.module.css";
import { PageHeader } from "@/components/PageHeader";
import { PersonPicker } from "@/components/PersonPicker";
import { Seo } from "@/components/Seo";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useDebounced } from "@/lib/hooks";
import { formatDateTime, formatMoney, humanize, timeAgo } from "@/lib/format";
import { CONTENT_LABELS, contentHref, safeUrl } from "@/lib/links";

const ACTIONS: ModerationActionName[] = ["dismiss", "warn", "hide", "remove", "restore", "restrict", "suspend", "ban"];
const person = (p: unknown) => {
  const x = (p ?? {}) as { display_name?: string; handle?: string | null };
  return x.handle ? <Link to={`/u/${x.handle}`}>{x.display_name ?? x.handle}</Link> : (x.display_name ?? "–");
};
const contentLink = (type: string, id: string) => {
  const href = contentHref(type, id);
  const label = CONTENT_LABELS[type] ?? type;
  return href ? <Link to={href}>{label}</Link> : <span>{label}</span>;
};

// ------------------------------------------------------------------ moderation
function CaseView({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useCase(id);
  const act = useTakeAction(id);
  const assign = useAssignCase();
  const toast = useToast();
  const [action, setAction] = useState<ModerationActionName>("hide");
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState("");
  const [kind, setKind] = useState<"posting" | "commenting" | "all">("posting");
  if (detail.isPending) return <Spinner />;
  if (detail.isError) return <ErrorState error={detail.error} />;
  const c = detail.data;
  return (
    <Section
      title={<>Case: {contentLink(c.content_type, c.object_id)}</>}
      actions={
        <>
          <ActionButton run={() => assign.mutateAsync(c.id)} success="Assigned to you">
            Take this case
          </ActionButton>
          <Button variant="ghost" onClick={onClose}>
            Back to the queue
          </Button>
        </>
      }
    >
      <KeyValues
        items={[
          ["Status", <StatusBadge key="s" status={c.status} />],
          ["Author", person(c.author)],
          ["Content now", c.current_status],
          ["Reports", c.report_count],
          ["Priority", c.priority],
          ["Opened", formatDateTime(c.created_at)],
          ["Resolution", c.resolution],
        ]}
      />
      {c.excerpt && <p className={m.pre}>{c.excerpt}</p>}
      <h3 style={{ fontSize: "var(--text-base)" }}>Reports</h3>
      <ul className={m.list}>
        {(c.reports as { id: string; reason?: string; details?: string; created_at: string }[]).map((r) => (
          <li key={r.id} className={m.small}>
            <strong>{humanize(r.reason ?? "")}</strong> {r.details} · {timeAgo(r.created_at)}
          </li>
        ))}
      </ul>
      <h3 style={{ fontSize: "var(--text-base)" }}>Actions so far</h3>
      <ul className={m.list}>
        {(c.actions as { id: string; action: string; reason: string; created_at: string; automated: boolean }[]).map(
          (a) => (
            <li key={a.id} className={m.small}>
              <strong>{humanize(a.action)}</strong> {a.automated && "(automatic)"} {a.reason} · {timeAgo(a.created_at)}
            </li>
          ),
        )}
      </ul>
      <form
        className={m.form}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          act.mutate(
            {
              action,
              reason,
              ...(["restrict", "suspend"].includes(action) && hours ? { duration_hours: Number(hours) } : {}),
              ...(action === "restrict" ? { restriction_kind: kind } : {}),
            },
            {
              onSuccess: () => (setReason(""), toast.success("Done")),
              onError: (err) => toast.error(errorMessage(err)),
            },
          );
        }}
      >
        <div className={m.formRow}>
          <Field label="Decision">
            <Select value={action} onChange={(e) => setAction(e.target.value as ModerationActionName)}>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {humanize(a)}
                </option>
              ))}
            </Select>
          </Field>
          {["restrict", "suspend"].includes(action) && (
            <Field label="For how many hours" optional>
              <Input type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} />
            </Field>
          )}
          {action === "restrict" && (
            <Field label="Stop them">
              <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="posting">Posting</option>
                <option value="commenting">Commenting</option>
                <option value="all">Posting and commenting</option>
              </Select>
            </Field>
          )}
        </div>
        <Field label="Reason (shown to the author)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div>
          <Button type="submit" loading={act.isPending}>
            Apply decision
          </Button>
        </div>
      </form>
    </Section>
  );
}

function Cases() {
  const [status, setStatus] = useState("open");
  const [type, setType] = useState("");
  const [mine, setMine] = useState(false);
  const cases = useCases({ status, content_type: type, assigned: mine ? "me" : "" });
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <CaseView id={open} onClose={() => setOpen(null)} />;
  return (
    <Section title="Reports queue" description="Highest priority first. Anonymous authors stay anonymous here.">
      <div className="cluster">
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="actioned">Actioned</option>
          <option value="dismissed">Dismissed</option>
          <option value="">All</option>
        </Select>
        <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Every type</option>
          {Object.entries(CONTENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Checkbox label="Assigned to me" checked={mine} onChange={(e) => setMine(e.target.checked)} />
      </div>
      {cases.isPending ? (
        <Spinner />
      ) : cases.isError ? (
        <ErrorState error={cases.error} />
      ) : (
        <DataTable<CaseSummary>
          caption="Cases"
          rows={cases.data.results}
          rowKey={(c) => c.id}
          columns={[
            { header: "What", cell: (c) => contentLink(c.content_type, c.object_id) },
            { header: "Excerpt", cell: (c) => <span className={m.small}>{c.excerpt.slice(0, 100)}</span> },
            { header: "Reports", end: true, cell: (c) => c.report_count },
            { header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
            { header: "Opened", cell: (c) => timeAgo(c.created_at) },
            {
              header: <span className="visually-hidden">Open</span>,
              end: true,
              cell: (c) => (
                <Button size="sm" onClick={() => setOpen(c.id)}>
                  Review
                </Button>
              ),
            },
          ]}
        />
      )}
    </Section>
  );
}

function Appeals() {
  const [status, setStatus] = useState("pending");
  const appeals = useAppealQueue(status);
  const decide = useDecideAppeal();
  return (
    <Section title="Appeals" description="Decide appeals against decisions you didn't make yourself.">
      <Select
        aria-label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        style={{ maxWidth: "12rem" }}
      >
        <option value="pending">Pending</option>
        <option value="upheld">Upheld</option>
        <option value="overturned">Overturned</option>
      </Select>
      {appeals.isPending ? (
        <Spinner />
      ) : (
        <ul className={m.list}>
          {appeals.data?.map((a) => {
            const action = a.action as { action?: string; content_type?: string; object_id?: string; reason?: string };
            return (
              <li key={a.id} className={m.item} style={{ flexDirection: "column", alignItems: "stretch" }}>
                <span>
                  {action.content_type && contentLink(action.content_type, action.object_id ?? "")} ·{" "}
                  <strong>{humanize(action.action ?? "")}</strong> {action.reason && `(${action.reason})`} ·{" "}
                  {person(a.appellant)}
                </span>
                <p className="pre-wrap">"{a.statement}"</p>
                {a.status === "pending" ? (
                  <div className="cluster">
                    <ActionButton
                      reason="Reason (sent to them)"
                      run={(reason) => decide.mutateAsync({ id: a.id, overturn: true, reason })}
                      success="Overturned"
                    >
                      Overturn
                    </ActionButton>
                    <ActionButton
                      reason="Reason (sent to them)"
                      run={(reason) => decide.mutateAsync({ id: a.id, overturn: false, reason })}
                      success="Upheld"
                    >
                      Uphold
                    </ActionButton>
                  </div>
                ) : (
                  <StatusBadge status={a.status} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function Rules() {
  const rules = useRules();
  const update = useUpdateRule();
  const toast = useToast();
  return (
    <Section
      title="Automatic rules"
      description="Content is hidden automatically when a rule fires; a person still reviews it."
    >
      <ul className={m.list}>
        {rules.data?.map((r) => (
          <li key={r.id} className={m.item}>
            <div className={m.itemMain}>
              <strong>{r.name}</strong>
              <span className={m.small}>
                {r.description} · {humanize(r.rule_type)} · then {humanize(r.action ?? "")} ·{" "}
                <code>{JSON.stringify(r.params)}</code>
              </span>
            </div>
            <Checkbox
              label="On"
              checked={Boolean(r.is_active)}
              onChange={(e) =>
                update.mutate(
                  { id: r.id, body: { is_active: e.target.checked } },
                  { onSuccess: () => toast.success("Rule updated"), onError: (err) => toast.error(errorMessage(err)) },
                )
              }
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Restrictions() {
  const list = useRestrictions();
  const lift = useLiftRestriction();
  return (
    <Section title="Restricted people" description="People currently stopped from posting or commenting.">
      {list.isPending ? (
        <Spinner />
      ) : (list.data ?? []).length === 0 ? (
        <p className="muted">Nobody is restricted.</p>
      ) : (
        <ul className={m.list}>
          {list.data!.map((r) => (
            <li key={r.id} className={m.item}>
              <span>
                {person(r.user)} · {humanize(r.kind)} until {formatDateTime(r.ends_at)} {r.reason && `· ${r.reason}`}
              </span>
              <ActionButton run={() => lift.mutateAsync(r.id)} success="Lifted">
                Lift
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ------------------------------------------------------------- social pages
function SocialQueue() {
  const channels = useSocialChannels();
  const [status, setStatus] = useState("pending_review");
  const queue = useSocialQueue(status);
  const act = useSocialAction();
  return (
    <Section
      title="GistLoop's social media"
      description="Podcast episodes go out automatically; anonymous gist only when its author asked and you approve it. Check it names nobody and is safe to show publicly."
    >
      <div className="cluster">
        {channels.data?.map((c) => (
          <Badge key={c.key} tone={c.enabled ? "success" : "neutral"}>
            {c.name}: {c.enabled ? "on" : "not set up"}
          </Badge>
        ))}
      </div>
      <Select
        aria-label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        style={{ maxWidth: "14rem" }}
      >
        <option value="pending_review">Waiting for review</option>
        <option value="approved">Sending</option>
        <option value="sent">Sent</option>
        <option value="rejected">Declined</option>
        <option value="taken_down">Taken down</option>
      </Select>
      {queue.isPending ? (
        <Spinner />
      ) : (queue.data ?? []).length === 0 ? (
        <p className="muted">Nothing here.</p>
      ) : (
        <ul className={m.list}>
          {queue.data!.map((item) => (
            <li key={item.id} className={m.item} style={{ flexDirection: "column", alignItems: "stretch" }}>
              <span className="cluster" style={{ justifyContent: "space-between" }}>
                <strong>{item.kind === "anonymous_post" ? "Anonymous gist" : `Episode: ${item.title}`}</strong>
                <StatusBadge status={item.status} />
              </span>
              <p className={m.pre}>{item.text}</p>
              {item.card_url && (
                <img
                  src={item.card_url}
                  alt="Card that will be posted"
                  style={{ maxWidth: "12rem", borderRadius: "var(--radius-md)" }}
                />
              )}
              {item.deliveries.length > 0 && (
                <span className="cluster">
                  {item.deliveries.map((d) => {
                    const url = safeUrl(d.external_url);
                    return (
                      <span key={d.channel} className={m.small}>
                        {humanize(d.channel)}: <StatusBadge status={d.status} />{" "}
                        {url && (
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            view
                          </a>
                        )}
                        {d.error && ` (${d.error})`}
                      </span>
                    );
                  })}
                </span>
              )}
              {item.review_note && <span className={m.small}>Note: {item.review_note}</span>}
              <div className="cluster">
                {item.status === "pending_review" && (
                  <>
                    <ActionButton
                      variant="primary"
                      run={() => act.mutateAsync({ id: item.id, action: "approve" })}
                      success="Approved: sending now"
                    >
                      Approve and send
                    </ActionButton>
                    <ActionButton
                      reason="Why not? (kept for the record)"
                      run={(note) => act.mutateAsync({ id: item.id, action: "reject", note })}
                      success="Declined"
                    >
                      Decline
                    </ActionButton>
                  </>
                )}
                {item.deliveries.some((d) => d.status === "failed") && (
                  <ActionButton run={() => act.mutateAsync({ id: item.id, action: "retry" })} success="Retrying">
                    Retry failed
                  </ActionButton>
                )}
                {(item.status === "sent" || item.status === "approved") && (
                  <ActionButton
                    variant="danger"
                    reason="Why take it down?"
                    run={(note) => act.mutateAsync({ id: item.id, action: "take-down", note })}
                    success="Taken down where the platforms allow it"
                  >
                    Take down
                  </ActionButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ------------------------------------------------------------ money
function Payouts() {
  const [status, setStatus] = useState("requested");
  const queue = usePayoutQueue(status);
  const decide = useDecidePayout();
  return (
    <Section title="Payout requests" description="Pay sellers and organisers, then record the bank transfer reference.">
      <Select
        aria-label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        style={{ maxWidth: "12rem" }}
      >
        {["requested", "paid", "rejected", "cancelled"].map((s) => (
          <option key={s} value={s}>
            {humanize(s)}
          </option>
        ))}
      </Select>
      <ul className={m.list}>
        {queue.data?.map((p) => (
          <li key={p.id} className={m.item}>
            <div className={m.itemMain}>
              <strong>{formatMoney(p.amount_minor, p.currency)}</strong>
              <span className={m.small}>
                {p.destination} · {formatDateTime(p.created_at)}
                {p.external_reference && ` · ref ${p.external_reference}`}
              </span>
            </div>
            {p.status === "requested" && (
              <div className={m.rowActions}>
                <ActionButton
                  variant="primary"
                  reason="Bank transfer reference"
                  run={(ref) => decide.mutateAsync({ id: p.id, approve: true, body: { external_reference: ref } })}
                  success="Marked as paid"
                >
                  Mark paid
                </ActionButton>
                <ActionButton
                  reason="Why? (sent to them)"
                  run={(note) => decide.mutateAsync({ id: p.id, approve: false, body: { note } })}
                  success="Rejected"
                >
                  Reject
                </ActionButton>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Disputes() {
  const disputes = useDisputes();
  const resolve = useResolveDispute();
  return (
    <Section title="Order disputes" description="The money is held until you decide.">
      {(disputes.data ?? []).length === 0 && !disputes.isPending && <p className="muted">No open disputes.</p>}
      <ul className={m.list}>
        {disputes.data?.map((o) => (
          <li key={o.id} className={m.item} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>
              <Link to={`/marketplace/orders/${o.id}`}>{o.title}</Link> · {formatMoney(o.total_minor, o.currency)} ·
              buyer {person(o.buyer)} · seller {person(o.seller)}
            </span>
            <span className={m.small}>"{o.dispute_reason}"</span>
            <div className="cluster">
              <ActionButton
                reason="Note (sent to both)"
                run={(note) => resolve.mutateAsync({ id: o.id, body: { outcome: "refund", note: note || "Refunded" } })}
                success="Buyer refunded"
              >
                Refund the buyer
              </ActionButton>
              <ActionButton
                reason="Note (sent to both)"
                run={(note) =>
                  resolve.mutateAsync({ id: o.id, body: { outcome: "release", note: note || "Released" } })
                }
                success="Paid to the seller"
              >
                Pay the seller
              </ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function RefundLookup() {
  const [ref, setRef] = useState("");
  const reference = useDebounced(ref.trim());
  const payment = usePayment(reference.length > 6 ? reference : undefined);
  const refunds = useRefunds(payment.data ? reference : undefined);
  const refund = useRefund(reference);
  const [amount, setAmount] = useState("");
  return (
    <Section title="Refund a payment">
      <Field label="Payment reference">
        <Input value={ref} onChange={(e) => setRef(e.target.value)} />
      </Field>
      {payment.isError && <ErrorState error={payment.error} />}
      {payment.data && (
        <>
          <KeyValues
            items={[
              ["What", payment.data.description || payment.data.purpose],
              ["Amount", formatMoney(payment.data.amount_minor, payment.data.currency)],
              ["Refunded", formatMoney(payment.data.amount_refunded_minor, payment.data.currency)],
              ["Status", <StatusBadge key="s" status={payment.data.status} />],
            ]}
          />
          <ul className={m.list}>
            {refunds.data?.map((r) => (
              <li key={r.reference} className={m.small}>
                {formatMoney(r.amount_minor, payment.data!.currency)} <StatusBadge status={r.status} /> {r.reason}
              </li>
            ))}
          </ul>
          <div className="cluster">
            <Field label="Amount (₦, empty = everything left)" optional>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <ActionButton
              variant="danger"
              reason="Reason"
              run={(reason) =>
                refund.mutateAsync({
                  amount_minor: amount ? Math.round(Number(amount) * 100) : null,
                  reason: reason || "Refund",
                })
              }
              success="Refund started"
            >
              Refund
            </ActionButton>
          </div>
        </>
      )}
    </Section>
  );
}

// -------------------------------------------------------------- reviews
function Promotions() {
  const queue = usePromotionQueue();
  const review = useReviewPromotion();
  return (
    <Section
      title="Adverts and boosts to review"
      description="Paid campaigns only run once approved; rejected ones are refunded."
    >
      {(queue.data ?? []).length === 0 && !queue.isPending && <p className="muted">Nothing to review.</p>}
      <ul className={m.list}>
        {queue.data?.map((c) => (
          <li key={c.id} className={m.item}>
            <div className={m.itemMain}>
              <Link to={`/promote/${c.id}`}>
                <strong>{c.name}</strong>
              </Link>
              <span className={m.small}>
                {humanize(c.kind)} · {formatMoney(c.budget_minor, c.currency)}
              </span>
            </div>
            <div className={m.rowActions}>
              <ActionButton
                variant="primary"
                run={() => review.mutateAsync({ id: c.id, approve: true })}
                success="Approved"
              >
                Approve
              </ActionButton>
              <ActionButton
                reason="Why? (sent to them)"
                run={(note) => review.mutateAsync({ id: c.id, approve: false, note })}
                success="Rejected and refunded"
              >
                Reject
              </ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Support staff: a creator's numbers (creator.analytics.view) and revoking their badge. */
function CreatorLookup() {
  const [handle, setHandle] = useState("");
  const lookup = useDebounced(handle.trim().replace(/^@/, ""));
  const creator = useCreator(lookup.length >= 2 ? lookup : undefined);
  const [range, setRange] = useState<Range>({});
  const report = useQuery({
    queryKey: ["staff", "creatorStats", creator.data?.id, range],
    enabled: Boolean(creator.data?.id),
    queryFn: () =>
      request<AnalyticsReport>("GET", `/api/v1/creators/${creator.data!.id}/analytics/`, {
        query: { from: range.from, to: range.to },
      }),
  });
  const revoke = useRevokeCreatorVerification();
  return (
    <Section title="Look up a creator">
      <Field label="Username">
        <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@username" />
      </Field>
      {creator.data && (
        <>
          <p>
            <Link to={`/creators/${lookup}`}>{creator.data.user?.display_name}</Link>{" "}
            {creator.data.is_verified && <Badge tone="success">Verified</Badge>}
          </p>
          {creator.data.is_verified && (
            <ActionButton
              variant="danger"
              reason="Why? (sent to them)"
              run={(reason) => revoke.mutateAsync({ id: creator.data!.id, reason: reason || "Revoked" })}
              success="Verification revoked"
            >
              Revoke verification
            </ActionButton>
          )}
          <RangePicker value={range} onChange={setRange} />
          <AnalyticsReportView query={report} />
        </>
      )}
    </Section>
  );
}

function Creators() {
  const [status, setStatus] = useState("pending");
  const queue = useCreatorVerificationQueue(status);
  const decide = useDecideCreatorVerification();
  const accounts = useAccountsToConfirm();
  const confirm = useConfirmAccount();
  return (
    <>
      <Section title="Creator verification requests">
        <Select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ maxWidth: "12rem" }}
        >
          {["pending", "approved", "rejected", "withdrawn"].map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
        <ul className={m.list}>
          {queue.data?.map((r) => (
            <li key={r.id} className={m.item} style={{ flexDirection: "column", alignItems: "stretch" }}>
              <span>
                {r.profile?.handle ? (
                  <Link to={`/creators/${r.profile.handle}`}>{r.profile.display_name}</Link>
                ) : (
                  r.profile?.display_name
                )}{" "}
                · {timeAgo(r.created_at)}
              </span>
              <p className="pre-wrap">{r.statement}</p>
              {Array.isArray(r.links) &&
                (r.links as string[]).map((l) =>
                  safeUrl(l) ? (
                    <a
                      key={l}
                      href={safeUrl(l)!}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className={m.small}
                    >
                      {l}
                    </a>
                  ) : null,
                )}
              {r.status === "pending" && (
                <div className="cluster">
                  <ActionButton
                    variant="primary"
                    run={() => decide.mutateAsync({ id: r.id, approve: true })}
                    success="Verified"
                  >
                    Verify
                  </ActionButton>
                  <ActionButton
                    reason="Why? (sent to them)"
                    run={(reason) => decide.mutateAsync({ id: r.id, approve: false, reason })}
                    success="Declined"
                  >
                    Decline
                  </ActionButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <CreatorLookup />
      <Section
        title="Linked accounts to check by hand"
        description="Platforms we can't check automatically. Confirm the code is in their bio first."
      >
        <ul className={m.list}>
          {accounts.data?.map((a) => (
            <li key={a.id} className={m.item}>
              <span>
                {humanize(a.provider)} @{a.handle} · code <code>{a.challenge}</code>{" "}
                {safeUrl(a.url) && (
                  <a href={safeUrl(a.url)!} target="_blank" rel="noopener noreferrer nofollow">
                    open
                  </a>
                )}
              </span>
              <ActionButton
                reason="Follower count you saw (optional)"
                run={(count) => confirm.mutateAsync({ id: a.id, followers: count ? Number(count) : undefined })}
                success="Confirmed"
              >
                Confirm ownership
              </ActionButton>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ people
function People() {
  const [handle, setHandle] = useState("");
  const query = useDebounced(handle.trim().replace(/^@/, ""));
  const user = useUserByHandle(query);
  const act = useAccountAction();
  return (
    <Section
      title="Accounts"
      description="Suspend, ban, reactivate or restore an account. Everything is recorded in the audit log."
    >
      <Field label="Username">
        <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@username" />
      </Field>
      {user.isError && query && <p className="muted">No account with that username.</p>}
      {user.data && (
        <>
          <KeyValues
            items={[
              [
                "Name",
                <Link key="n" to={`/u/${user.data.handle}`}>
                  {user.data.display_name}
                </Link>,
              ],
              ["Email", user.data.email],
              ["Phone", user.data.phone_number],
              ["Joined", formatDateTime(user.data.created_at)],
              ["ID", <code key="i">{user.data.id}</code>],
            ]}
          />
          <div className="cluster">
            <ActionButton
              reason="Reason (sent to them)"
              run={(reason) => act.mutateAsync({ userId: user.data!.id, action: "suspend", reason })}
              success="Suspended"
            >
              Suspend
            </ActionButton>
            <ActionButton
              variant="danger"
              reason="Reason (sent to them)"
              run={(reason) => act.mutateAsync({ userId: user.data!.id, action: "ban", reason })}
              success="Banned"
            >
              Ban
            </ActionButton>
            <ActionButton
              run={() => act.mutateAsync({ userId: user.data!.id, action: "reactivate" })}
              success="Reactivated"
            >
              Reactivate
            </ActionButton>
            <ActionButton run={() => act.mutateAsync({ userId: user.data!.id, action: "restore" })} success="Restored">
              Restore deleted account
            </ActionButton>
            <Link to={`/staff?audit=${user.data.id}`}>Audit trail</Link>
          </div>
        </>
      )}
    </Section>
  );
}

function Roles() {
  const roles = useRoles();
  const perms = useAllPermissions();
  const save = useSaveRole();
  const [scopeType, setScopeType] = useState("platform");
  const [scopeId, setScopeId] = useState("");
  const assignments = useRoleAssignments(scopeType, scopeId);
  const assign = useAssignRole();
  const revoke = useRevokeRole();
  const toast = useToast();
  const [roleId, setRoleId] = useState("");
  const [draft, setDraft] = useState({ key: "", name: "", scope_type: "platform", permissions: [] as string[] });
  return (
    <>
      <Section
        title="Who has a role"
        description="Give people roles on the whole platform, or in one school, community or podcast (use its ID)."
      >
        <div className="cluster">
          <Field label="Where">
            <Select value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
              {["platform", "institution", "campus", "community", "podcast", "event"].map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
          {scopeType !== "platform" && (
            <Field label="Its ID">
              <Input value={scopeId} onChange={(e) => setScopeId(e.target.value)} />
            </Field>
          )}
        </div>
        <ul className={m.list}>
          {assignments.data
            ?.filter((a) => !a.revoked_at)
            .map((a) => (
              <li key={a.id} className={m.item}>
                <span>
                  <code>{a.user}</code> · {roles.data?.find((r) => r.id === a.role || r.key === a.role)?.name ?? a.role}
                  {a.expires_at && ` · until ${formatDateTime(a.expires_at)}`}
                </span>
                <ActionButton variant="danger" run={() => revoke.mutateAsync(a.id)} success="Role removed">
                  Remove
                </ActionButton>
              </li>
            ))}
        </ul>
        <div className={m.formRow}>
          <Field label="Role">
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">Choose a role</option>
              {roles.data
                ?.filter((r) => (r.scope_type || "platform") === scopeType)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </Select>
          </Field>
          <PersonPicker
            label="Give it to"
            action="Assign"
            onPick={(p) =>
              roleId
                ? assign.mutate(
                    {
                      user: p.id,
                      role: roleId,
                      scope_type: scopeType,
                      scope_id: scopeType === "platform" ? "" : scopeId,
                    },
                    {
                      onSuccess: () => toast.success(`Role given to ${p.display_name}`),
                      onError: (e) => toast.error(errorMessage(e)),
                    },
                  )
                : toast.error("Choose a role first")
            }
          />
        </div>
      </Section>
      <Section title="Roles">
        <ul className={m.list}>
          {roles.data?.map((r) => (
            <li key={r.id} className={m.item}>
              <div className={m.itemMain}>
                <strong>
                  {r.name} {r.is_system && <Badge>Built in</Badge>}
                </strong>
                <span className={m.small}>
                  {humanize(r.scope_type || "platform")} ·{" "}
                  {Array.isArray(r.permissions) ? (r.permissions as string[]).join(", ") : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <form
          className={m.form}
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              { body: { ...draft, key: draft.key || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "_") } },
              {
                onSuccess: () => (
                  setDraft({ key: "", name: "", scope_type: "platform", permissions: [] }),
                  toast.success("Role created")
                ),
                onError: (err) => toast.error(errorMessage(err)),
              },
            );
          }}
        >
          <h3 style={{ fontSize: "var(--text-base)" }}>New role</h3>
          <div className={m.formRow}>
            <Field label="Name">
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </Field>
            <Field label="Where it applies">
              <Select
                value={draft.scope_type}
                onChange={(e) => setDraft((d) => ({ ...d, scope_type: e.target.value }))}
              >
                {["platform", "institution", "campus", "community", "podcast", "event"].map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <fieldset className="stack" style={{ border: 0, padding: 0, maxHeight: "16rem", overflow: "auto" }}>
            <legend style={{ fontWeight: 650 }}>Permissions</legend>
            {perms.data
              ?.filter(
                (p) => p.scopes.includes("*") || p.scopes.includes(draft.scope_type) || draft.scope_type === "platform",
              )
              .map((p) => (
                <Checkbox
                  key={p.code}
                  label={
                    <>
                      <code>{p.code}</code> {p.description} {p.sensitive && <Badge tone="danger">Sensitive</Badge>}
                    </>
                  }
                  checked={draft.permissions.includes(p.code)}
                  onChange={() =>
                    setDraft((d) => ({
                      ...d,
                      permissions: d.permissions.includes(p.code)
                        ? d.permissions.filter((x) => x !== p.code)
                        : [...d.permissions, p.code],
                    }))
                  }
                />
              ))}
          </fieldset>
          <div>
            <Button
              type="submit"
              loading={save.isPending}
              disabled={!draft.name.trim() || draft.permissions.length === 0}
            >
              Create role
            </Button>
          </div>
        </form>
      </Section>
    </>
  );
}

function Audit({ initialTarget }: { initialTarget?: string }) {
  const [filters, setFilters] = useState({
    action: "",
    category: "",
    outcome: "",
    actor: initialTarget ?? "",
    since: "",
    until: "",
  });
  const [page, setPage] = useState(1);
  const debounced = useDebounced(filters);
  const log = useAuditLog({ ...Object.fromEntries(Object.entries(debounced).filter(([, v]) => v)), page });
  const set = (key: keyof typeof filters) => (e: { target: { value: string } }) => (
    setFilters((f) => ({ ...f, [key]: e.target.value })),
    setPage(1)
  );
  return (
    <Section
      title="Audit log"
      description="Every sensitive action on the platform, signed so it can't be changed quietly."
    >
      <div className={m.formRow}>
        <Field label="Action" optional>
          <Input value={filters.action} onChange={set("action")} placeholder="e.g. user.banned" />
        </Field>
        <Field label="Who (user ID)" optional>
          <Input value={filters.actor} onChange={set("actor")} />
        </Field>
        <Field label="Category" optional>
          <Input value={filters.category} onChange={set("category")} />
        </Field>
        <Field label="Result" optional>
          <Select value={filters.outcome} onChange={set("outcome")}>
            <option value="">Any</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="denied">Denied</option>
          </Select>
        </Field>
        <Field label="Since" optional>
          <Input type="date" value={filters.since} onChange={set("since")} />
        </Field>
        <Field label="Until" optional>
          <Input type="date" value={filters.until} onChange={set("until")} />
        </Field>
      </div>
      {log.isPending ? (
        <Spinner />
      ) : log.isError ? (
        <ErrorState error={log.error} />
      ) : (
        <>
          <DataTable
            caption="Audit log"
            rows={log.data.results}
            rowKey={(r) => r.id}
            columns={[
              { header: "When", cell: (r) => formatDateTime(r.created_at) },
              { header: "Action", cell: (r) => <code>{r.action}</code> },
              {
                header: "Result",
                cell: (r) => (
                  <StatusBadge status={r.outcome === "success" ? "completed" : "failed"} label={r.outcome} />
                ),
              },
              { header: "Who", cell: (r) => <span className={m.small}>{r.actor_ref}</span> },
              {
                header: "On",
                cell: (r) => <span className={m.small}>{[r.target_type, r.target_id].filter(Boolean).join(" ")}</span>,
              },
              { header: "From", cell: (r) => <span className={m.small}>{r.ip_address}</span> },
            ]}
          />
          <div className="cluster">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Newer
            </Button>
            <Button size="sm" variant="secondary" disabled={!log.data.next} onClick={() => setPage((p) => p + 1)}>
              Older
            </Button>
          </div>
        </>
      )}
    </Section>
  );
}

function Reveal() {
  const list = useRevealRequests();
  const create = useRequestReveal();
  const decide = useDecideReveal();
  const toast = useToast();
  const [form, setForm] = useState({
    kind: "post" as "post" | "comment" | "message",
    object_id: "",
    justification: "",
    case_reference: "",
  });
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  return (
    <Section
      title={
        <>
          <ShieldAlert size={18} aria-hidden /> Reveal an anonymous author
        </>
      }
      description="Only for serious harm or a lawful request. Two people are needed: one asks, a different one approves. Every look is recorded."
    >
      <Alert tone="warning">
        Revealing someone breaks the promise of anonymity. Use it only when the law or someone's safety requires it.
      </Alert>
      <form
        className={m.form}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { ...form, case_reference: form.case_reference || undefined },
            {
              onSuccess: () => toast.success("Request recorded. Another administrator must approve it."),
              onError: (err) => toast.error(errorMessage(err)),
            },
          );
        }}
      >
        <div className={m.formRow}>
          <Field label="What">
            <Select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as typeof form.kind }))}
            >
              <option value="post">Anonymous post</option>
              <option value="comment">Anonymous reply</option>
              <option value="message">Anonymous inbox message</option>
            </Select>
          </Field>
          <Field label="Its ID">
            <Input value={form.object_id} onChange={(e) => setForm((f) => ({ ...f, object_id: e.target.value }))} />
          </Field>
          <Field label="Case or police reference" optional>
            <Input
              value={form.case_reference}
              onChange={(e) => setForm((f) => ({ ...f, case_reference: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Justification">
          <Textarea
            value={form.justification}
            onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
          />
        </Field>
        <div>
          <Button
            type="submit"
            variant="danger"
            loading={create.isPending}
            disabled={!form.object_id || form.justification.length < 20}
          >
            Request a reveal
          </Button>
        </div>
      </form>
      <ul className={m.list}>
        {list.data?.map((r) => (
          <li key={r.id} className={m.item} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span>
              {humanize(r.kind)} <code>{r.object_id}</code> · <StatusBadge status={r.status} /> · asked by{" "}
              {r.requester?.handle ? `@${r.requester.handle}` : "an administrator"} {timeAgo(r.created_at)}
              {r.case_reference && ` · ref ${r.case_reference}`}
            </span>
            <span className={m.small}>{r.justification}</span>
            {r.status === "pending" && (
              <div className="cluster">
                <ActionButton
                  variant="danger"
                  reason="Why approve?"
                  run={(reason) => decide.mutateAsync({ id: r.id, approve: true, reason })}
                  success="Approved"
                >
                  Approve
                </ActionButton>
                <ActionButton
                  reason="Why not?"
                  run={(reason) => decide.mutateAsync({ id: r.id, approve: false, reason })}
                  success="Declined"
                >
                  Decline
                </ActionButton>
              </div>
            )}
            {r.status === "approved" && (
              <div className="cluster">
                {revealed[r.id] ? (
                  <code>{revealed[r.id]}</code>
                ) : (
                  <ActionButton
                    confirm="This is recorded in the audit log. Continue?"
                    run={async () => {
                      const who = await fetchRevealedIdentity(r.id);
                      setRevealed((x) => ({
                        ...x,
                        [r.id]: `${who.display_name} (@${who.handle ?? "–"}) ${who.email} · ${who.user_id}`,
                      }));
                    }}
                  >
                    Show identity ({r.retrieval_count} looks so far)
                  </ActionButton>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Schools() {
  const create = useCreateInstitution();
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    short_name: "",
    type: "university",
    ownership: "public",
    region: "",
    city: "",
    website: "",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  return (
    <Section
      title="Add a school"
      description="For many at once, use the import command with a spreadsheet (see the README)."
    >
      <form
        className={m.form}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { ...form, country: "NG", website: form.website || "" },
            { onSuccess: (s) => toast.success(`${s.name} added`), onError: (err) => toast.error(errorMessage(err)) },
          );
        }}
      >
        <div className={m.formRow}>
          <Field label="Name">
            <Input value={form.name} onChange={set("name")} required />
          </Field>
          <Field label="Short name">
            <Input value={form.short_name} onChange={set("short_name")} />
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={set("type")}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ownership">
            <Select value={form.ownership} onChange={set("ownership")}>
              {["public", "private", "faith_based", "community", "other"].map((o) => (
                <option key={o} value={o}>
                  {humanize(o)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="State">
            <Input value={form.region} onChange={set("region")} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={set("city")} />
          </Field>
          <Field label="Website" optional>
            <Input type="url" value={form.website} onChange={set("website")} />
          </Field>
        </div>
        <div>
          <Button type="submit" loading={create.isPending}>
            Add school
          </Button>
        </div>
      </form>
    </Section>
  );
}

function Stats() {
  const [range, setRange] = useState<Range>({});
  const report = usePlatformAnalytics(range);
  return (
    <Section title="Platform numbers">
      <RangePicker value={range} onChange={setRange} />
      <AnalyticsReportView query={report} />
    </Section>
  );
}

type Tab =
  | "cases"
  | "appeals"
  | "rules"
  | "restrictions"
  | "social"
  | "promotions"
  | "payouts"
  | "disputes"
  | "refunds"
  | "creators"
  | "people"
  | "roles"
  | "audit"
  | "reveal"
  | "schools"
  | "stats";

const TABS: { value: Tab; label: string; perm: string }[] = [
  { value: "cases", label: "Reports", perm: "moderation.cases.view" },
  { value: "appeals", label: "Appeals", perm: "moderation.appeals.decide" },
  { value: "rules", label: "Rules", perm: "moderation.rules.manage" },
  { value: "restrictions", label: "Restrictions", perm: "moderation.users.restrict" },
  { value: "social", label: "Social pages", perm: "syndication.review" },
  { value: "promotions", label: "Adverts", perm: "promotions.review" },
  { value: "payouts", label: "Payouts", perm: "payments.payouts.manage" },
  { value: "disputes", label: "Disputes", perm: "marketplace.disputes.resolve" },
  { value: "refunds", label: "Refunds", perm: "payments.refunds.manage" },
  { value: "creators", label: "Creators", perm: "creator.verify" },
  { value: "people", label: "Accounts", perm: "users.suspend" },
  { value: "roles", label: "Roles", perm: "permissions.roles.view" },
  { value: "audit", label: "Audit log", perm: "audit.view" },
  { value: "reveal", label: "Reveal", perm: "anonymous.identity.reveal" },
  { value: "schools", label: "Schools", perm: "institution.manage" },
  { value: "stats", label: "Numbers", perm: "analytics.view" },
];

/** /staff: GistLoop's own team. Each section appears only with its permission. */
export default function StaffPage() {
  const perms = usePermissions("platform", "");
  const [tab, setTab] = useState<Tab | null>(null);
  const auditTarget = new URLSearchParams(window.location.search).get("audit") ?? undefined;
  if (perms.isPending) return <PageLoader />;
  const allowed = TABS.filter((t) => can(perms.data, t.perm));
  if (allowed.length === 0) return <NoAccess />;
  const current = tab ?? (auditTarget && allowed.some((t) => t.value === "audit") ? "audit" : allowed[0]!.value);
  return (
    <div className="stack">
      <Seo title="Staff" noIndex />
      <PageHeader title="Staff console" description="Everything here is recorded in the audit log." />
      <Tabs label="Staff" value={current} onChange={setTab} items={allowed} />
      {current === "cases" && <Cases />}
      {current === "appeals" && <Appeals />}
      {current === "rules" && <Rules />}
      {current === "restrictions" && <Restrictions />}
      {current === "social" && <SocialQueue />}
      {current === "promotions" && <Promotions />}
      {current === "payouts" && <Payouts />}
      {current === "disputes" && <Disputes />}
      {current === "refunds" && <RefundLookup />}
      {current === "creators" && <Creators />}
      {current === "people" && <People />}
      {current === "roles" && <Roles />}
      {current === "audit" && <Audit initialTarget={auditTarget} />}
      {current === "reveal" && <Reveal />}
      {current === "schools" && <Schools />}
      {current === "stats" && <Stats />}
    </div>
  );
}
