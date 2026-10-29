import {
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  CalendarClock,
  Download,
  ExternalLink,
  Mail,
  MapPin,
  Megaphone,
  Users,
  Wallet,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import { ApiError, errorMessage } from "@/api/errors";
import {
  type Opportunity,
  type OpportunityApplication,
  type OpportunityFilters,
  type OpportunityKind,
  type WorkMode,
  downloadResume,
  useApplicants,
  useApply,
  useCreateOpportunity,
  useDecideApplication,
  useMyOpportunities,
  useOpportunities,
  useOpportunity,
  useOpportunityStatus,
  useToggleSaveOpportunity,
  useWithdrawApplication,
} from "@/api/queries/opportunities";
import type { components } from "@/api/schema";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { AnchorButton, Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { FilePicker } from "@/components/ui/FilePicker";
import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { PageLoader, Skeleton, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import browse from "@/features/content/Browse.module.css";
import { BrowseShell } from "@/features/content/BrowseShell";
import styles from "@/features/content/Lists.module.css";
import { Sponsored } from "@/features/promotions/Sponsored";
import { formatDate, formatMoney, humanize, timeAgo } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import { safeUrl } from "@/lib/links";

type S = components["schemas"];

const KINDS: OpportunityKind[] = ["job", "internship", "gig", "scholarship", "fellowship", "volunteer", "competition"];
const MODES: WorkMode[] = ["on_site", "remote", "hybrid"];
const MODE_LABELS: Record<string, string> = { on_site: "On site", remote: "Remote", hybrid: "Hybrid" };
const PERIOD_LABELS: Record<string, string> = {
  hour: "/hour",
  day: "/day",
  month: "/month",
  year: "/year",
  fixed: " total",
  stipend: " stipend",
  unpaid: "",
};

/** "₦150,000 – ₦250,000/month", "Unpaid" or null when no pay is given. */
function formatPay(o: Opportunity): string | null {
  if (o.pay_period === "unpaid") return "Unpaid";
  const { pay_min_minor: min, pay_max_minor: max } = o;
  if (min == null && max == null) return null;
  const range =
    min != null && max != null && min !== max
      ? `${formatMoney(min, o.currency)} – ${formatMoney(max, o.currency)}`
      : formatMoney((min ?? max)!, o.currency);
  return `${range}${PERIOD_LABELS[o.pay_period] ?? ""}`;
}

export function OpportunityCard({ opportunity: o }: { opportunity: Opportunity }) {
  const pay = formatPay(o);
  return (
    <Card interactive padded={false}>
      <Link to={`/opportunities/${o.id}`} className={browse.tile}>
        <div className={browse.tileBody}>
          <div className={browse.tileMeta}>
            <Badge tone="primary">{humanize(o.kind)}</Badge>
            {o.verified && (
              <Badge tone="success">
                <BadgeCheck size={12} aria-hidden /> Verified
              </Badge>
            )}
            {o.status === "closed" && <Badge>Closed</Badge>}
          </div>
          <h3 className={browse.tileTitle}>{o.title}</h3>
          <p className={browse.tileText}>{o.organization_name}</p>
          <div className={browse.tileMeta}>
            <span className={browse.metaItem}>
              <MapPin size={14} aria-hidden /> {[o.location, MODE_LABELS[o.work_mode]].filter(Boolean).join(" · ")}
            </span>
            {pay && (
              <span className={browse.metaItem}>
                <Wallet size={14} aria-hidden /> {pay}
              </span>
            )}
            {o.deadline && (
              <span className={browse.metaItem}>
                <CalendarClock size={14} aria-hidden /> Apply by {formatDate(o.deadline)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
}

/** /opportunities: jobs, internships, scholarships and more. Public. */
export default function OpportunitiesPage() {
  const { status } = useAuth();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<OpportunityFilters["kind"]>("");
  const [mode, setMode] = useState<OpportunityFilters["work_mode"]>("");
  const [paid, setPaid] = useState(false);
  const list = useOpportunities({ q: useDebounced(q), kind, work_mode: mode, paid });

  return (
    <BrowseShell
      eyebrow="Opportunities"
      title="Jobs, internships and scholarships for students"
      description="Roles and funding from organisations that want to hear from students. Verified posts carry a badge."
      actions={
        status === "signed-in" ? (
          <div className="cluster">
            <ButtonLink to="/opportunities/mine" variant="secondary">
              Yours
            </ButtonLink>
            <ButtonLink to="/opportunities/new">Post an opportunity</ButtonLink>
          </div>
        ) : undefined
      }
    >
      <Seo title="Opportunities" description="Jobs, internships, gigs and scholarships for students on GistLoop." />
      <div className={browse.toolbar}>
        <label htmlFor="opp-search" className="visually-hidden">
          Search opportunities
        </label>
        <Input
          id="opp-search"
          type="search"
          placeholder="Search roles, organisations, skills"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label htmlFor="opp-kind" className="visually-hidden">
          Type
        </label>
        <Select id="opp-kind" value={kind} onChange={(e) => setKind(e.target.value as OpportunityFilters["kind"])}>
          <option value="">All types</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {humanize(k)}
            </option>
          ))}
        </Select>
        <label htmlFor="opp-mode" className="visually-hidden">
          Work mode
        </label>
        <Select id="opp-mode" value={mode} onChange={(e) => setMode(e.target.value as OpportunityFilters["work_mode"])}>
          <option value="">Anywhere</option>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </Select>
        <Checkbox
          label="Paid only"
          checked={paid}
          onChange={(e) => setPaid(e.target.checked)}
          style={{ alignSelf: "center" }}
        />
      </div>
      <Sponsored placement="opportunities" />
      {list.isPending ? (
        <div className={browse.grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height="12rem" radius="var(--radius-lg)" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.results.length === 0 ? (
        <EmptyState icon={Briefcase} title="No opportunities found">
          Try different filters, or check back soon.
        </EmptyState>
      ) : (
        <div className={browse.grid}>
          {list.data.results.map((o) => (
            <OpportunityCard key={o.id} opportunity={o} />
          ))}
        </div>
      )}
    </BrowseShell>
  );
}

/** /opportunities/:opportunityId */
export function OpportunityPage() {
  const { opportunityId } = useParams();
  const { status } = useAuth();
  const opportunity = useOpportunity(opportunityId);
  const save = useToggleSaveOpportunity();
  const setStatus = useOpportunityStatus();
  const toast = useToast();
  const [applying, setApplying] = useState(false);

  if (opportunity.isPending) return <PageLoader />;
  if (opportunity.isError) return <ErrorState error={opportunity.error} onRetry={() => void opportunity.refetch()} />;

  const o = opportunity.data;
  const pay = formatPay(o);
  const orgUrl = safeUrl(o.organization_url);
  const applyUrl = safeUrl(o.apply_url);
  const open = o.status === "open";
  const applied = o.viewer.application_status;
  const signedIn = status === "signed-in";
  const changeStatus = (action: S["OpportunityStatusActionActionEnum"], done: string) =>
    setStatus.mutate(
      { id: o.id, action },
      { onSuccess: () => toast.success(done), onError: (e) => toast.error(errorMessage(e)) },
    );

  return (
    <div
      className={signedIn ? "stack" : "container stack"}
      style={signedIn ? undefined : { paddingBlock: "var(--space-8)" }}
    >
      <Seo title={`${o.title} at ${o.organization_name}`} description={o.description.slice(0, 160)} />
      <Card>
        <div className="stack">
          <div className={browse.tileMeta}>
            <Badge tone="primary">{humanize(o.kind)}</Badge>
            {o.verified && (
              <Badge tone="success">
                <BadgeCheck size={12} aria-hidden /> Verified organisation
              </Badge>
            )}
            {o.status !== "open" && <Badge tone="warning">{humanize(o.status)}</Badge>}
          </div>
          <h1 style={{ margin: 0, fontSize: "var(--text-2xl)" }}>{o.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {orgUrl ? (
              <a href={orgUrl} target="_blank" rel="noopener noreferrer nofollow">
                {o.organization_name}
              </a>
            ) : (
              o.organization_name
            )}{" "}
            · posted {timeAgo(o.published_at ?? o.created_at)}
          </p>
          <ul className={browse.facts}>
            <li>
              <MapPin size={16} aria-hidden /> {[o.location, MODE_LABELS[o.work_mode]].filter(Boolean).join(" · ")}
            </li>
            {pay && (
              <li>
                <Wallet size={16} aria-hidden /> {pay}
              </li>
            )}
            {o.deadline && (
              <li>
                <CalendarClock size={16} aria-hidden /> Apply by {formatDate(o.deadline)}
              </li>
            )}
            {o.starts_on && (
              <li>
                <CalendarClock size={16} aria-hidden /> Starts {formatDate(o.starts_on)}
              </li>
            )}
          </ul>

          {o.viewer.is_poster ? (
            <div className="cluster">
              <ButtonLink to={`/opportunities/${o.id}/applicants`} leading={<Users size={16} />}>
                Applicants ({o.applications_count})
              </ButtonLink>
              {o.status === "draft" && (
                <Button
                  variant="secondary"
                  loading={setStatus.isPending}
                  onClick={() => changeStatus("publish", "Published")}
                >
                  Publish
                </Button>
              )}
              {o.status === "open" && (
                <>
                  <ButtonLink
                    to={`/promote/new?type=opportunities.opportunity&id=${o.id}`}
                    variant="secondary"
                    leading={<Megaphone size={16} />}
                  >
                    Boost
                  </ButtonLink>
                  <Button
                    variant="ghost"
                    loading={setStatus.isPending}
                    onClick={() => changeStatus("close", "Applications closed")}
                  >
                    Close applications
                  </Button>
                </>
              )}
              {o.status === "closed" && (
                <Button
                  variant="secondary"
                  loading={setStatus.isPending}
                  onClick={() => changeStatus("reopen", "Reopened")}
                >
                  Reopen
                </Button>
              )}
            </div>
          ) : !signedIn ? (
            <div>
              <ButtonLink to={`/login?next=${encodeURIComponent(`/opportunities/${o.id}`)}`}>
                Sign in to apply
              </ButtonLink>
            </div>
          ) : (
            <div className="cluster">
              {applied ? (
                <Badge tone="primary">Application: {humanize(applied)}</Badge>
              ) : !open ? (
                <Badge>Applications are closed</Badge>
              ) : o.apply_method === "in_app" ? (
                <Button onClick={() => setApplying(true)}>Apply now</Button>
              ) : o.apply_method === "external" && applyUrl ? (
                <AnchorButton
                  href={applyUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  leading={<ExternalLink size={16} />}
                >
                  Apply on their site
                </AnchorButton>
              ) : o.apply_method === "email" && o.apply_email ? (
                <AnchorButton
                  href={`mailto:${o.apply_email}?subject=${encodeURIComponent(`Application: ${o.title}`)}`}
                  leading={<Mail size={16} />}
                >
                  Apply by email
                </AnchorButton>
              ) : null}
              <Button
                variant="ghost"
                loading={save.isPending}
                leading={o.viewer.saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                onClick={() =>
                  save.mutate({ id: o.id, saved: o.viewer.saved }, { onError: (e) => toast.error(errorMessage(e)) })
                }
              >
                {o.viewer.saved ? "Saved" : "Save"}
              </Button>
            </div>
          )}
        </div>
      </Card>
      <Card>
        <h2 style={{ fontSize: "var(--text-lg)", marginTop: 0 }}>About the role</h2>
        <p className={styles.body}>{o.description}</p>
        {Array.isArray(o.tags) && o.tags.length > 0 && (
          <div className="cluster">
            {(o.tags as string[]).map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <div className="cluster">
          <Avatar name={o.poster.display_name} seed={o.poster.id} src={o.poster.avatar_url} size="sm" />
          <span>
            Posted by{" "}
            {o.poster.handle ? (
              <Link to={`/u/${o.poster.handle}`}>{o.poster.display_name}</Link>
            ) : (
              o.poster.display_name
            )}
          </span>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Never pay to apply for a job. If something looks wrong, tell us from the poster's profile or{" "}
          <Link to="/safety">read our safety tips</Link>.
        </p>
      </Card>
      {applying && <ApplyDialog opportunity={o} onClose={() => setApplying(false)} />}
    </div>
  );
}

function ApplyDialog({ opportunity: o, onClose }: { opportunity: Opportunity; onClose: () => void }) {
  const { me } = useAuth();
  const apply = useApply(o.id);
  const toast = useToast();
  const [coverNote, setCoverNote] = useState("");
  const [email, setEmail] = useState(me?.email ?? "");
  const [resume, setResume] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    apply.mutate(
      { cover_note: coverNote, contact_email: email, resume },
      {
        onSuccess: () => {
          toast.success("Application sent. Good luck!");
          onClose();
        },
        onError: (e) => {
          if (e instanceof ApiError) setErrors(e.fieldErrors);
          toast.error(errorMessage(e));
        },
      },
    );
  };

  return (
    <Dialog open onClose={onClose} title={`Apply: ${o.title}`}>
      <form className="stack" onSubmit={onSubmit}>
        <Field label="Cover note" optional hint="Why you, in a few lines." error={errors.cover_note}>
          <Textarea rows={5} maxLength={4000} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} />
        </Field>
        <Field label="Contact email" hint="Only the poster sees it." error={errors.contact_email}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="CV" optional hint="PDF, up to 5 MB. Only the poster can download it." error={errors.resume}>
          <div className="cluster">
            <FilePicker
              accept="application/pdf"
              onPick={(files) => {
                const file = files[0];
                if (!file) return;
                if (file.type !== "application/pdf") return toast.error("Choose a PDF file.");
                if (file.size > 5 * 1024 * 1024) return toast.error("Choose a file under 5 MB.");
                setResume(file);
              }}
            >
              {resume ? "Change file" : "Choose PDF"}
            </FilePicker>
            {resume && <span className="muted">{resume.name}</span>}
          </div>
        </Field>
        {errors.non_field_errors && <Alert tone="error">{errors.non_field_errors}</Alert>}
        <div className="cluster">
          <Button type="submit" loading={apply.isPending}>
            Send application
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** /opportunities/new */
export function PostOpportunityPage() {
  const navigate = useNavigate();
  const create = useCreateOpportunity();
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    kind: "internship" as OpportunityKind,
    title: "",
    organization_name: "",
    organization_url: "",
    description: "",
    location: "",
    work_mode: "on_site" as WorkMode,
    pay_period: "month" as S["PayPeriodEnum"],
    pay_min: "",
    pay_max: "",
    deadline: "",
    starts_on: "",
    apply_method: "in_app" as S["ApplyMethodEnum"],
    apply_url: "",
    apply_email: "",
    tags: "",
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toMinor = (naira: string) => (naira ? Math.round(Number(naira) * 100) : null);
  const unpaid = form.pay_period === "unpaid";

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    create.mutate(
      {
        kind: form.kind,
        title: form.title,
        organization_name: form.organization_name,
        organization_url: form.organization_url,
        description: form.description,
        location: form.location,
        work_mode: form.work_mode,
        pay_period: form.pay_period,
        pay_min_minor: unpaid ? null : toMinor(form.pay_min),
        pay_max_minor: unpaid ? null : toMinor(form.pay_max),
        currency: "NGN",
        // End of the chosen day, in the browser's time zone.
        deadline: form.deadline ? new Date(`${form.deadline}T23:59:00`).toISOString() : null,
        starts_on: form.starts_on || null,
        apply_method: form.apply_method,
        apply_url: form.apply_method === "external" ? form.apply_url : "",
        apply_email: form.apply_method === "email" ? form.apply_email : "",
        audience: "public",
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10),
        publish: true,
      },
      {
        onSuccess: (o) => {
          toast.success("Your opportunity is live!");
          navigate(`/opportunities/${o.id}`);
        },
        onError: (e) => {
          if (e instanceof ApiError) setErrors(e.fieldErrors);
          toast.error(errorMessage(e));
        },
      },
    );
  };

  return (
    <>
      <Seo title="Post an opportunity" noIndex />
      <PageHeader title="Post an opportunity" description="Reach students directly. Posts are free; spam is removed." />
      <Card>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <div className={styles.fields}>
            <Field label="Type" error={errors.kind}>
              <Select value={form.kind} onChange={(e) => set("kind", e.target.value as OpportunityKind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {humanize(k)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Work mode" error={errors.work_mode}>
              <Select value={form.work_mode} onChange={(e) => set("work_mode", e.target.value as WorkMode)}>
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Title" error={errors.title}>
            <Input maxLength={200} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <div className={styles.fields}>
            <Field label="Organisation" error={errors.organization_name}>
              <Input
                maxLength={200}
                value={form.organization_name}
                onChange={(e) => set("organization_name", e.target.value)}
              />
            </Field>
            <Field label="Organisation website" optional error={errors.organization_url}>
              <Input
                type="url"
                placeholder="https://"
                value={form.organization_url}
                onChange={(e) => set("organization_url", e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Description"
            hint="What the role involves, who should apply and how you'll decide."
            error={errors.description}
          >
            <Textarea
              rows={8}
              maxLength={8000}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <Field label="Location" optional hint="e.g. Lagos, or Remote (Nigeria)" error={errors.location}>
            <Input maxLength={120} value={form.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <div className={styles.fields}>
            <Field label="Pay" error={errors.pay_period}>
              <Select value={form.pay_period} onChange={(e) => set("pay_period", e.target.value as S["PayPeriodEnum"])}>
                <option value="month">Per month</option>
                <option value="year">Per year</option>
                <option value="hour">Per hour</option>
                <option value="day">Per day</option>
                <option value="fixed">Fixed amount</option>
                <option value="stipend">Stipend</option>
                <option value="unpaid">Unpaid</option>
              </Select>
            </Field>
            {!unpaid && (
              <>
                <Field label="From (₦)" optional error={errors.pay_min_minor}>
                  <Input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={form.pay_min}
                    onChange={(e) => set("pay_min", e.target.value)}
                  />
                </Field>
                <Field label="To (₦)" optional error={errors.pay_max_minor}>
                  <Input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={form.pay_max}
                    onChange={(e) => set("pay_max", e.target.value)}
                  />
                </Field>
              </>
            )}
          </div>
          <div className={styles.fields}>
            <Field label="Application deadline" optional error={errors.deadline}>
              <Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
            </Field>
            <Field label="Start date" optional error={errors.starts_on}>
              <Input type="date" value={form.starts_on} onChange={(e) => set("starts_on", e.target.value)} />
            </Field>
          </div>
          <Field label="How people apply" error={errors.apply_method}>
            <Select
              value={form.apply_method}
              onChange={(e) => set("apply_method", e.target.value as S["ApplyMethodEnum"])}
            >
              <option value="in_app">On GistLoop (cover note and CV)</option>
              <option value="external">On our website</option>
              <option value="email">By email</option>
            </Select>
          </Field>
          {form.apply_method === "external" && (
            <Field label="Application link" error={errors.apply_url}>
              <Input
                type="url"
                placeholder="https://"
                value={form.apply_url}
                onChange={(e) => set("apply_url", e.target.value)}
              />
            </Field>
          )}
          {form.apply_method === "email" && (
            <Field label="Application email" error={errors.apply_email}>
              <Input type="email" value={form.apply_email} onChange={(e) => set("apply_email", e.target.value)} />
            </Field>
          )}
          <Field label="Skills or tags" optional hint="Separated by commas, up to 10." error={errors.tags}>
            <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} />
          </Field>
          {errors.non_field_errors && <Alert tone="error">{errors.non_field_errors}</Alert>}
          <div>
            <Button
              type="submit"
              loading={create.isPending}
              disabled={!form.title.trim() || !form.organization_name.trim() || !form.description.trim()}
            >
              Publish
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

const APPLICATION_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  submitted: "primary",
  shortlisted: "warning",
  hired: "success",
  rejected: "neutral",
  withdrawn: "neutral",
};

/** /opportunities/mine: applications, saved and posted. */
export function MyOpportunitiesPage() {
  const [params, setParams] = useSearchParams();
  const tab = (["saved", "posted"].includes(params.get("tab") ?? "") ? params.get("tab") : "applications") as
    "applications" | "saved" | "posted";

  return (
    <>
      <Seo title="Your opportunities" noIndex />
      <PageHeader
        title="Your opportunities"
        actions={<ButtonLink to="/opportunities/new">Post an opportunity</ButtonLink>}
      />
      <div className="stack">
        <Tabs
          label="Your opportunities"
          value={tab}
          onChange={(next) => setParams(next === "applications" ? {} : { tab: next })}
          items={[
            { value: "applications", label: "Applications" },
            { value: "saved", label: "Saved" },
            { value: "posted", label: "Posted" },
          ]}
        />
        {tab === "applications" ? <MyApplications /> : <MyOpportunityList which={tab} />}
      </div>
    </>
  );
}

function MyApplications() {
  const list = useMyOpportunities("applications");
  const withdraw = useWithdrawApplication();
  const toast = useToast();
  if (list.isPending) return <Spinner />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  const applications = list.data.results as OpportunityApplication[];
  if (applications.length === 0)
    return (
      <EmptyState icon={Briefcase} title="No applications yet">
        <Link to="/opportunities">Find an opportunity</Link>
      </EmptyState>
    );
  return (
    <ul className={styles.list}>
      {applications.map((a) => (
        <li key={a.id}>
          <Card>
            <div className={styles.row}>
              <div className={styles.info}>
                <Link to={`/opportunities/${a.opportunity.id}`}>
                  <strong>{a.opportunity.title}</strong>
                </Link>
                <span className="muted">
                  {a.opportunity.organization_name} · applied {timeAgo(a.created_at)}
                </span>
              </div>
              <div className="cluster">
                <Badge tone={APPLICATION_TONE[a.status] ?? "neutral"}>{humanize(a.status)}</Badge>
                {(a.status === "submitted" || a.status === "shortlisted") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={withdraw.isPending}
                    onClick={() =>
                      withdraw.mutate(a.id, {
                        onSuccess: () => toast.success("Application withdrawn"),
                        onError: (e) => toast.error(errorMessage(e)),
                      })
                    }
                  >
                    Withdraw
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function MyOpportunityList({ which }: { which: "saved" | "posted" }) {
  const list = useMyOpportunities(which);
  if (list.isPending) return <Spinner />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  const items = list.data.results as Opportunity[];
  if (items.length === 0)
    return (
      <EmptyState icon={Briefcase} title={which === "saved" ? "Nothing saved yet" : "You haven't posted anything"}>
        {which === "saved" ? (
          <Link to="/opportunities">Browse opportunities</Link>
        ) : (
          <Link to="/opportunities/new">Post one</Link>
        )}
      </EmptyState>
    );
  return (
    <div className={browse.grid}>
      {items.map((o) => (
        <OpportunityCard key={o.id} opportunity={o} />
      ))}
    </div>
  );
}

/** /opportunities/:opportunityId/applicants (the poster only). */
export function ApplicantsPage() {
  const { opportunityId } = useParams();
  const opportunity = useOpportunity(opportunityId);
  const applicants = useApplicants(opportunityId);
  const decide = useDecideApplication(opportunityId ?? "");
  const toast = useToast();

  return (
    <>
      <Seo title="Applicants" noIndex />
      <PageHeader
        eyebrow={
          opportunity.data ? (
            <Link to={`/opportunities/${opportunity.data.id}`}>{opportunity.data.title}</Link>
          ) : undefined
        }
        title="Applicants"
        description="Shortlist, hire or turn down. Applicants are told when their status changes."
      />
      {applicants.isPending ? (
        <Spinner />
      ) : applicants.isError ? (
        <ErrorState error={applicants.error} onRetry={() => void applicants.refetch()} />
      ) : applicants.data.results.length === 0 ? (
        <EmptyState icon={Users} title="No applications yet" />
      ) : (
        <ul className={styles.list}>
          {applicants.data.results.map((a) => (
            <li key={a.id}>
              <Card>
                <div className="stack">
                  <div className={styles.row}>
                    <div className="cluster">
                      <Avatar name={a.applicant.display_name} seed={a.applicant.id} src={a.applicant.avatar_url} />
                      <div className={styles.info}>
                        {a.applicant.handle ? (
                          <Link to={`/u/${a.applicant.handle}`}>
                            <strong>{a.applicant.display_name}</strong>
                          </Link>
                        ) : (
                          <strong>{a.applicant.display_name}</strong>
                        )}
                        <span className="muted">
                          {a.contact_email && <a href={`mailto:${a.contact_email}`}>{a.contact_email}</a>} · applied{" "}
                          {timeAgo(a.created_at)}
                        </span>
                      </div>
                    </div>
                    <Badge tone={APPLICATION_TONE[a.status] ?? "neutral"}>{humanize(a.status)}</Badge>
                  </div>
                  {a.cover_note && <p className={styles.quote}>{a.cover_note}</p>}
                  <div className="cluster">
                    {a.has_resume && (
                      <Button
                        size="sm"
                        variant="secondary"
                        leading={<Download size={14} />}
                        onClick={() => void downloadResume(a).catch((e) => toast.error(errorMessage(e)))}
                      >
                        Download CV
                      </Button>
                    )}
                    {a.status !== "withdrawn" &&
                      (["shortlisted", "hired", "rejected"] as const)
                        .filter((s) => s !== a.status)
                        .map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={s === "rejected" ? "ghost" : "secondary"}
                            loading={decide.isPending}
                            onClick={() =>
                              decide.mutate(
                                { applicationId: a.id, status: s },
                                {
                                  onSuccess: () => toast.success(`Marked as ${s}`),
                                  onError: (e) => toast.error(errorMessage(e)),
                                },
                              )
                            }
                          >
                            {s === "shortlisted" ? "Shortlist" : s === "hired" ? "Hire" : "Turn down"}
                          </Button>
                        ))}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
