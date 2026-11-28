import { useRecordView } from "@/api/queries/analytics";
import { BadgeCheck, ExternalLink, GraduationCap, MapPin, Settings2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { errorMessage } from "@/api/errors";
import {
  type AcademicUnit,
  type Campus,
  type Institution,
  type Level,
  type Membership,
  type Programme,
  ROLES,
  ROLE_LABELS,
  TYPE_LABELS,
  VERIFY_METHOD_LABELS,
  can,
  schoolName,
  useCompleteVerification,
  useInstitution,
  useInstitutions,
  useJoinInstitution,
  useMyMemberships,
  usePermissions,
  useSchoolAnnouncements,
  useSchoolPart,
  useStartVerification,
  useVerifications,
} from "@/api/queries/institutions";
import { useAudiencePosts } from "@/api/queries/social";
import { useAuth } from "@/auth/AuthProvider";
import { StatusBadge } from "@/components/Manage";
import { Seo } from "@/components/Seo";
import { ShareMenu } from "@/components/ShareMenu";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { FilePicker } from "@/components/ui/FilePicker";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { PageLoader, Skeleton, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { AnnouncementCard } from "@/features/announcements/AnnouncementsPage";
import browse from "@/features/content/Browse.module.css";
import { BrowseShell } from "@/features/content/BrowseShell";
import { Composer } from "@/features/feed/Composer";
import { PostList } from "@/features/feed/PostList";
import { GistBoard } from "@/features/gist/GistBoard";
import { humanize } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import { safeUrl } from "@/lib/links";

function SchoolCard({ school }: { school: Institution }) {
  return (
    <Card interactive padded={false}>
      <Link to={`/schools/${school.id}`} className={browse.tile}>
        <div className={browse.tileBody}>
          <div className={browse.tileMeta}>
            <Badge tone="primary">{TYPE_LABELS[school.type] ?? humanize(school.type)}</Badge>
            {school.is_verified && (
              <Badge tone="success">
                <BadgeCheck size={12} aria-hidden /> Verified
              </Badge>
            )}
          </div>
          <h3 className={browse.tileTitle}>{school.name}</h3>
          <p className={browse.tileText}>{school.short_name}</p>
          <span className={browse.metaItem}>
            <MapPin size={14} aria-hidden /> {[school.city, school.region].filter(Boolean).join(", ")}
          </span>
        </div>
      </Link>
    </Card>
  );
}

/** /schools: every institution in Nigeria on GistLoop. Public. */
export function SchoolsPage() {
  const { status } = useAuth();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const list = useInstitutions({ q: useDebounced(q), type, page });
  const pages = list.data ? Math.max(1, Math.ceil(list.data.count / 24)) : 1;
  return (
    <BrowseShell
      eyebrow="Schools"
      title="Every campus, one conversation"
      description="Universities, polytechnics and colleges across Nigeria. Join yours to see its feed, anonymous gist and official announcements."
      actions={
        status === "signed-in" ? (
          <ButtonLink to="/settings/schools" variant="secondary">
            Your schools
          </ButtonLink>
        ) : undefined
      }
    >
      <Seo title="Schools" description="Universities, polytechnics and colleges of education on GistLoop." />
      <div className={browse.toolbar}>
        <label htmlFor="school-search" className="visually-hidden">
          Search schools
        </label>
        <Input
          id="school-search"
          type="search"
          placeholder="Search by name, short name or city (e.g. UNILAG, Nsukka)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <label htmlFor="school-type" className="visually-hidden">
          Type
        </label>
        <Select
          id="school-type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {list.isPending ? (
        <div className={browse.grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height="9rem" radius="var(--radius-lg)" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.results.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No school matches">
          Try its short name or city. Can't find yours? <Link to="/contact">Tell us</Link> and we'll add it.
        </EmptyState>
      ) : (
        <>
          <div className={browse.grid}>
            {list.data.results.map((s) => (
              <SchoolCard key={s.id} school={s} />
            ))}
          </div>
          {pages > 1 && (
            <div className="cluster" style={{ justifyContent: "center" }}>
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="muted">
                Page {page} of {pages}
              </span>
              <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </BrowseShell>
  );
}

// ------------------------------------------------------------------ joining
/** Pick your role, campus, department, programme and level, then verify. */
export function JoinSchoolDialog({
  school,
  open,
  onClose,
  onJoined,
}: {
  school: Pick<Institution, "id" | "name" | "short_name">;
  open: boolean;
  onClose: () => void;
  onJoined?: (membership: Membership) => void;
}) {
  const join = useJoinInstitution();
  const campuses = useSchoolPart<Campus>(school.id, "campuses", open);
  const units = useSchoolPart<AcademicUnit>(school.id, "units", open);
  const programmes = useSchoolPart<Programme>(school.id, "programmes", open);
  const levels = useSchoolPart<Level>(school.id, "levels", open);
  const [form, setForm] = useState({
    role: "student",
    campus: "",
    academic_unit: "",
    programme: "",
    level: "",
    entry_year: "",
    graduation_year: "",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    join.mutate(
      {
        institution: school.id,
        role: form.role,
        campus: form.campus || undefined,
        academic_unit: form.academic_unit || undefined,
        programme: form.programme || undefined,
        level: form.level || undefined,
        entry_year: form.entry_year ? Number(form.entry_year) : undefined,
        graduation_year: form.graduation_year ? Number(form.graduation_year) : undefined,
      },
      { onSuccess: (m) => onJoined?.(m) },
    );
  };
  const year = new Date().getFullYear();
  return (
    <Dialog open={open} onClose={onClose} title={`Join ${school.short_name || school.name}`}>
      <form className="stack" onSubmit={onSubmit}>
        <Field label="You are a">
          <Select value={form.role} onChange={set("role")}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        {(campuses.data?.length ?? 0) > 1 && (
          <Field label="Campus" optional>
            <Select value={form.campus} onChange={set("campus")}>
              <option value="">Choose a campus</option>
              {campuses.data!.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {(units.data?.length ?? 0) > 0 && (
          <Field label="Faculty or department" optional>
            <Select value={form.academic_unit} onChange={set("academic_unit")}>
              <option value="">Choose one</option>
              {units.data!.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({humanize(u.unit_type)})
                </option>
              ))}
            </Select>
          </Field>
        )}
        {(programmes.data?.length ?? 0) > 0 && (
          <Field label="Programme" optional>
            <Select value={form.programme} onChange={set("programme")}>
              <option value="">Choose one</option>
              {programmes.data!.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.award, p.name].filter(Boolean).join(" ")}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {(levels.data?.length ?? 0) > 0 && (
          <Field label="Level" optional>
            <Select value={form.level} onChange={set("level")}>
              <option value="">Choose one</option>
              {levels.data!.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="cluster">
          <Field label="Year you started" optional>
            <Input type="number" min={1960} max={year} value={form.entry_year} onChange={set("entry_year")} />
          </Field>
          <Field label="Year you finish(ed)" optional>
            <Input
              type="number"
              min={1960}
              max={year + 8}
              value={form.graduation_year}
              onChange={set("graduation_year")}
            />
          </Field>
        </div>
        {join.isError && <Alert tone="error">{errorMessage(join.error)}</Alert>}
        <Button type="submit" loading={join.isPending}>
          Continue
        </Button>
      </form>
    </Dialog>
  );
}

/** Prove you belong: a school email code, an ID number, a document, or a request to the admins. */
export function VerifyMembership({ membership, methods }: { membership: Membership; methods: string[] }) {
  const verifications = useVerifications(membership.id);
  const start = useStartVerification(membership.id);
  const complete = useCompleteVerification(membership.id);
  const toast = useToast();
  const [method, setMethod] = useState(methods[0] ?? "manual");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [code, setCode] = useState("");
  const waiting = verifications.data?.find((v) => v.status === "awaiting_user" && v.method === "institution_email");
  const reviewing = verifications.data?.find((v) => v.status === "pending_review");

  if (membership.status === "verified") {
    return <Alert tone="success">You're a verified member. Enjoy the school's feed, gist and announcements.</Alert>;
  }
  if (verifications.isPending) return <Spinner />;
  if (reviewing) {
    return (
      <Alert tone="info">
        Your proof ({VERIFY_METHOD_LABELS[reviewing.method] ?? humanize(reviewing.method)}) is with the school's
        reviewers. We'll notify you when they decide.
      </Alert>
    );
  }
  if (waiting) {
    return (
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          complete.mutate(
            { verificationId: waiting.id, code: code.trim() },
            { onSuccess: () => toast.success("Verified! Welcome."), onError: (err) => toast.error(errorMessage(err)) },
          );
        }}
      >
        <Field label="Enter the code we emailed to your school address">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <div className="cluster">
          <Button type="submit" loading={complete.isPending} disabled={code.trim().length < 4}>
            Verify
          </Button>
          <Button type="button" variant="ghost" onClick={() => start.mutate({ method: "institution_email", email })}>
            Send a new code
          </Button>
        </div>
      </form>
    );
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    start.mutate(
      {
        method,
        email: method === "institution_email" ? email.trim() : undefined,
        identifier: method === "student_id" ? identifier.trim() : undefined,
        note: note.trim() || undefined,
        document: method === "document" && file ? file : undefined,
      },
      {
        onSuccess: () =>
          toast.success(method === "institution_email" ? "Check your school inbox for a code." : "Sent for review."),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };
  const last = verifications.data?.find((v) => v.status === "rejected");
  return (
    <form className="stack" onSubmit={onSubmit}>
      {last?.decision_reason && <Alert tone="warning">Last attempt was declined: {last.decision_reason}</Alert>}
      <Field label="How would you like to verify?">
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          {methods.map((m) => (
            <option key={m} value={m}>
              {VERIFY_METHOD_LABELS[m] ?? humanize(m)}
            </option>
          ))}
        </Select>
      </Field>
      {method === "institution_email" && (
        <Field label="Your school email address" hint="We'll send a code to it. It's never shown to anyone.">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
      )}
      {method === "student_id" && (
        <Field label="Matriculation or staff number" hint="Stored scrambled: only a short hint is kept.">
          <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </Field>
      )}
      {method === "document" && (
        <Field label="ID card or admission letter (PDF, JPG or PNG, up to 5 MB)">
          <FilePicker
            accept="application/pdf,image/jpeg,image/png"
            maxMb={5}
            variant="secondary"
            label={file ? file.name : "Choose a file"}
            onPick={(files) => setFile(files[0] ?? null)}
          >
            {file ? file.name : "Choose a file"}
          </FilePicker>
        </Field>
      )}
      {method !== "institution_email" && (
        <Field label="Anything the reviewers should know" optional>
          <Textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      )}
      {start.isError && <Alert tone="error">{errorMessage(start.error)}</Alert>}
      <Button type="submit" loading={start.isPending} disabled={method === "document" && !file}>
        {method === "institution_email" ? "Email me a code" : "Send for review"}
      </Button>
    </form>
  );
}

// ------------------------------------------------------------------ a school
type Tab = "posts" | "gist" | "campus" | "announcements" | "about";

function About({ school }: { school: Institution }) {
  const campuses = useSchoolPart<Campus>(school.id, "campuses");
  const units = useSchoolPart<AcademicUnit>(school.id, "units");
  const website = safeUrl(school.website);
  return (
    <Card>
      <div className="stack">
        <h2 style={{ fontSize: "var(--text-lg)" }}>About {school.short_name || school.name}</h2>
        {school.description && <p className="pre-wrap">{school.description}</p>}
        <p className="muted">
          {TYPE_LABELS[school.type] ?? humanize(school.type)}
          {school.ownership && ` · ${humanize(school.ownership)}`}
          {school.founded_year && ` · Founded ${school.founded_year}`}
        </p>
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} aria-hidden /> {website.replace(/^https?:\/\//, "")}
          </a>
        )}
        <h3 style={{ fontSize: "var(--text-base)" }}>Campuses</h3>
        {campuses.isPending ? (
          <Spinner />
        ) : (
          <ul style={{ paddingLeft: "1.2em" }}>
            {campuses.data?.map((c) => (
              <li key={c.id}>
                {c.name}
                {c.city && ` — ${c.city}`} {c.is_main && <Badge>Main</Badge>}
              </li>
            ))}
          </ul>
        )}
        {(units.data?.length ?? 0) > 0 && (
          <>
            <h3 style={{ fontSize: "var(--text-base)" }}>Faculties and departments</h3>
            <ul style={{ paddingLeft: "1.2em", columns: "16rem" }}>
              {units.data!.map((u) => (
                <li key={u.id}>{u.name}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

/** /schools/:institutionId */
export function SchoolPage() {
  const { institutionId } = useParams();
  const { status } = useAuth();
  const signedIn = status === "signed-in";
  const school = useInstitution(institutionId);
  useRecordView("institution.institution", school.data?.id);
  const mine = useMyMemberships(signedIn);
  const perms = usePermissions("institution", institutionId ?? "", signedIn && Boolean(institutionId));
  const [params] = useSearchParams();
  const initial = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(initial ?? "posts");
  const [joining, setJoining] = useState(false);
  const posts = useAudiencePosts("institution", institutionId);
  const announcements = useSchoolAnnouncements(institutionId, "published");
  const membership = mine.data?.find(
    (m) => m.institution.id === institutionId && !["left", "revoked"].includes(m.status),
  );
  const verified = membership?.status === "verified";

  if (school.isPending) return <PageLoader />;
  if (school.isError) return <ErrorState error={school.error} onRetry={() => void school.refetch()} />;
  const s = school.data;
  const manages = [
    "institution.edit",
    "institution.memberships.view",
    "institution.announcements.publish",
    "institution.structure.manage",
  ].some((code) => can(perms.data, code));
  const tabs: { value: Tab; label: string }[] = [
    { value: "posts", label: "Feed" },
    { value: "gist", label: "Anonymous gist" },
    ...(verified && membership?.campus ? [{ value: "campus" as Tab, label: "Campus gist" }] : []),
    { value: "announcements", label: "Announcements" },
    { value: "about", label: "About" },
  ];
  const membersOnly = (what: string) => (
    <Card>
      <p>
        {!signedIn ? (
          <>
            <Link to={`/login?next=/schools/${s.id}`}>Sign in</Link> and verify that you belong to{" "}
            {s.short_name || s.name} to see {what}.
          </>
        ) : membership ? (
          <>Verify your membership to see {what}. Check the box above.</>
        ) : (
          <>
            Join {s.short_name || s.name} and verify to see {what}.
          </>
        )}
      </p>
    </Card>
  );

  return (
    <div>
      <Seo title={s.name} description={`${s.name}: feed, anonymous gist and announcements on GistLoop.`} />
      <Card padded={false} className={browse.detailHero}>
        <div className={browse.detailHead}>
          <div className={browse.communityHead}>
            <span className={browse.communityIcon} aria-hidden style={{ width: "4rem", height: "4rem" }}>
              <GraduationCap size={28} />
            </span>
            <div className="stack" style={{ "--stack-gap": "var(--space-1)" } as React.CSSProperties}>
              <h1 className={browse.detailTitle}>{schoolName(s)}</h1>
              <div className="cluster" style={{ "--cluster-gap": "var(--space-2)" } as React.CSSProperties}>
                <Badge tone="primary">{TYPE_LABELS[s.type] ?? humanize(s.type)}</Badge>
                {s.is_verified && (
                  <Badge tone="success">
                    <BadgeCheck size={12} aria-hidden /> Verified school
                  </Badge>
                )}
                <span className="muted">
                  <MapPin size={14} aria-hidden style={{ display: "inline", verticalAlign: "-2px" }} />{" "}
                  {[s.city, s.region].filter(Boolean).join(", ")}
                </span>
                {membership && (
                  <StatusBadge
                    status={membership.status}
                    label={membership.status === "verified" ? "Member" : undefined}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="cluster">
            <ShareMenu title={s.name} path={`/schools/${s.id}`} />
            {manages && (
              <ButtonLink to={`/schools/${s.id}/manage`} variant="secondary" leading={<Settings2 size={16} />}>
                Manage
              </ButtonLink>
            )}
            {!signedIn ? (
              <ButtonLink to={`/login?next=/schools/${s.id}`}>Sign in to join</ButtonLink>
            ) : !membership ? (
              <Button onClick={() => setJoining(true)}>I study or work here</Button>
            ) : null}
          </div>
        </div>
        {membership && !verified && (
          <div style={{ padding: "0 var(--space-6) var(--space-5)" }}>
            <Card>
              <h2 style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-3)" }}>
                Verify that you belong here
              </h2>
              <VerifyMembership membership={membership} methods={s.available_verification_methods} />
            </Card>
          </div>
        )}
      </Card>
      <JoinSchoolDialog
        school={s}
        open={joining}
        onClose={() => setJoining(false)}
        onJoined={() => setJoining(false)}
      />

      <div style={{ marginTop: "var(--space-5)" }}>
        <Tabs label="School sections" value={tab} onChange={setTab} items={tabs} />
      </div>
      <div style={{ marginTop: "var(--space-5)" }} className="stack">
        {tab === "posts" &&
          (verified ? (
            <>
              <Composer audience={{ type: "institution", id: s.id, name: s.short_name || s.name }} />
              <PostList
                query={posts}
                empty={{ title: "No posts yet", body: "Start your school's first conversation." }}
              />
            </>
          ) : (
            membersOnly("your school's feed")
          ))}
        {tab === "gist" &&
          (verified ? (
            <GistBoard audience={{ type: "institution", id: s.id }} canPost />
          ) : (
            membersOnly("anonymous gist")
          ))}
        {tab === "campus" && verified && membership?.campus && (
          <GistBoard audience={{ type: "campus", id: membership.campus }} canPost />
        )}
        {tab === "announcements" &&
          (announcements.isPending ? (
            <Spinner />
          ) : announcements.isError ? (
            <ErrorState error={announcements.error} />
          ) : announcements.data.length === 0 ? (
            <EmptyState title="No announcements">Official notices from the school will appear here.</EmptyState>
          ) : (
            announcements.data.map((a) => <AnnouncementCard key={a.id} announcement={a} />)
          ))}
        {tab === "about" && <About school={s} />}
      </div>
    </div>
  );
}
