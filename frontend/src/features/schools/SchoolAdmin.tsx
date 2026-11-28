import { ScopeStats } from "@/components/AnalyticsReport";
import { FileText, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router";

import { errorMessage } from "@/api/errors";
import {
  type AcademicSession,
  type AcademicUnit,
  type Announcement,
  type AnnouncementWrite,
  type Campus,
  type Institution,
  type Level,
  type Member,
  type MemberAction,
  type Programme,
  type SchoolDomain,
  type StructureKind,
  ROLE_LABELS,
  VERIFY_METHOD_LABELS,
  can,
  openVerificationDocument,
  useAddSemester,
  useAddStructure,
  useAnnouncementAction,
  useEditStructure,
  useInstitution,
  usePermissions,
  useRemoveDomain,
  useReviewMember,
  useSaveAnnouncement,
  useSchoolAnnouncements,
  useSchoolMembers,
  useSchoolPart,
  useUpdateInstitution,
} from "@/api/queries/institutions";
import m from "@/components/Manage.module.css";
import { ActionButton, DataTable, NoAccess, Section, StatusBadge } from "@/components/Manage";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { AnnouncementCard } from "@/features/announcements/AnnouncementsPage";
import { formatDate, humanize, timeAgo } from "@/lib/format";

// ------------------------------------------------------------------ members
function Members({ school, perms }: { school: Institution; perms: Set<string> | undefined }) {
  const [status, setStatus] = useState("pending");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const members = useSchoolMembers(school.id, { status, role, page });
  const review = useReviewMember(school.id);
  const toast = useToast();
  const verify = can(perms, "institution.memberships.verify");
  const manage = can(perms, "institution.memberships.manage");
  const act = (member: Member, action: MemberAction) => (reason: string) =>
    review.mutateAsync({ membershipId: member.id, action, reason: reason || undefined });
  const pending = (member: Member) =>
    member.pending_verification as {
      id: string;
      method: string;
      has_document: boolean;
      evidence?: Record<string, unknown>;
    } | null;
  return (
    <Section title="Members" description="Review people who say they study or work here, and manage existing members.">
      <div className="cluster">
        <label htmlFor="member-status" className="visually-hidden">
          Status
        </label>
        <Select id="member-status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
          {["pending", "verified", "rejected", "suspended", "revoked", "left"].map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
        <label htmlFor="member-role" className="visually-hidden">
          Role
        </label>
        <Select id="member-role" value={role} onChange={(e) => (setRole(e.target.value), setPage(1))}>
          <option value="">Every role</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      {members.isPending ? (
        <Spinner />
      ) : members.isError ? (
        <ErrorState error={members.error} />
      ) : members.data.results.length === 0 ? (
        <p className="muted">Nobody here.</p>
      ) : (
        <DataTable
          caption="Members"
          rows={members.data.results}
          rowKey={(r) => r.id}
          columns={[
            {
              header: "Person",
              cell: (r) => (
                <span className="cluster" style={{ "--cluster-gap": "var(--space-2)" } as React.CSSProperties}>
                  <Avatar name={r.user.display_name} seed={r.user.id} src={r.user.avatar_url} size="sm" />
                  <span>
                    {r.user.handle ? (
                      <Link to={`/u/${r.user.handle}`}>{r.user.display_name}</Link>
                    ) : (
                      r.user.display_name
                    )}
                    <br />
                    <span className={m.small}>
                      {ROLE_LABELS[r.role] ?? r.role}
                      {r.identifier_hint && ` · ID ${r.identifier_hint}`}
                      {r.entry_year && ` · from ${r.entry_year}`}
                    </span>
                  </span>
                </span>
              ),
            },
            { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            {
              header: "Proof",
              cell: (r) => {
                const v = pending(r);
                if (!v)
                  return r.verification_method ? (
                    <span className={m.small}>{humanize(r.verification_method)}</span>
                  ) : (
                    "–"
                  );
                return (
                  <span className="stack" style={{ "--stack-gap": "var(--space-1)" } as React.CSSProperties}>
                    <span>{VERIFY_METHOD_LABELS[v.method] ?? humanize(v.method)}</span>
                    {v.evidence && typeof v.evidence.note === "string" && (
                      <span className={m.small}>"{v.evidence.note}"</span>
                    )}
                    {v.has_document && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() =>
                          openVerificationDocument(school.id, r.id, v.id).catch((e) => toast.error(errorMessage(e)))
                        }
                      >
                        <FileText size={14} aria-hidden /> Open document
                      </button>
                    )}
                  </span>
                );
              },
            },
            { header: "Joined", cell: (r) => timeAgo(r.created_at) },
            {
              header: <span className="visually-hidden">Actions</span>,
              end: true,
              cell: (r) => (
                <div className={m.rowActions}>
                  {verify && r.status === "pending" && (
                    <>
                      <ActionButton variant="primary" run={act(r, "approve")} success="Approved">
                        Approve
                      </ActionButton>
                      <ActionButton reason="Reason (shown to them)" run={act(r, "reject")} success="Declined">
                        Decline
                      </ActionButton>
                    </>
                  )}
                  {manage && r.status === "verified" && (
                    <>
                      <ActionButton reason="Reason" run={act(r, "suspend")} success="Suspended">
                        Suspend
                      </ActionButton>
                      <ActionButton
                        variant="danger"
                        reason="Reason"
                        run={act(r, "revoke")}
                        success="Membership revoked"
                      >
                        Revoke
                      </ActionButton>
                    </>
                  )}
                  {manage && r.status === "suspended" && (
                    <ActionButton run={act(r, "approve")} success="Reinstated">
                      Reinstate
                    </ActionButton>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
      {members.data && members.data.count > members.data.results.length && (
        <div className="cluster">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled={!members.data.next} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- announcements
const CATEGORIES = [
  "general",
  "academic",
  "exams",
  "admissions",
  "events",
  "welfare",
  "security",
  "emergency",
] as const;

function AnnouncementForm({
  school,
  editing,
  onDone,
}: {
  school: Institution;
  editing?: Announcement;
  onDone: () => void;
}) {
  const save = useSaveAnnouncement(school.id);
  const campuses = useSchoolPart<Campus>(school.id, "campuses");
  const [form, setForm] = useState<AnnouncementWrite>({
    title: editing?.title ?? "",
    body: editing?.body ?? "",
    category: editing?.category as AnnouncementWrite["category"],
    audience: editing?.audience ?? "members",
    priority: editing?.priority ?? "normal",
    pinned: editing?.pinned ?? false,
    campus: editing?.campus ?? null,
    expires_at: editing?.expires_at ?? null,
    publish: false,
  });
  const set = <K extends keyof AnnouncementWrite>(key: K, value: AnnouncementWrite[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const onSubmit = (publish: boolean) => (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ announcementId: editing?.id, body: { ...form, publish } }, { onSuccess: onDone });
  };
  return (
    <form className={m.form} onSubmit={onSubmit(false)}>
      <Field label="Title">
        <Input value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} required />
      </Field>
      <Field label="Message">
        <Textarea rows={6} value={form.body} onChange={(e) => set("body", e.target.value)} required />
      </Field>
      <div className={m.formRow}>
        <Field label="Category">
          <Select
            value={form.category ?? "general"}
            onChange={(e) => set("category", e.target.value as AnnouncementWrite["category"])}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            value={form.priority}
            onChange={(e) => set("priority", e.target.value as AnnouncementWrite["priority"])}
          >
            <option value="normal">Normal</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent (notifies everyone now)</option>
          </Select>
        </Field>
        <Field label="Who can read it">
          <Select
            value={form.audience}
            onChange={(e) => set("audience", e.target.value as AnnouncementWrite["audience"])}
          >
            <option value="members">Verified members</option>
            <option value="public">Anyone</option>
          </Select>
        </Field>
        {(campuses.data?.length ?? 0) > 1 && (
          <Field label="Campus" optional>
            <Select value={form.campus ?? ""} onChange={(e) => set("campus", e.target.value || null)}>
              <option value="">Every campus</option>
              {campuses.data!.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Stop showing after" optional>
          <Input
            type="datetime-local"
            value={form.expires_at ? form.expires_at.slice(0, 16) : ""}
            onChange={(e) => set("expires_at", e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </Field>
      </div>
      <Checkbox
        label="Pin to the top"
        checked={Boolean(form.pinned)}
        onChange={(e) => set("pinned", e.target.checked)}
      />
      {save.isError && <Alert tone="error">{errorMessage(save.error)}</Alert>}
      <div className="cluster">
        <Button type="button" loading={save.isPending} onClick={onSubmit(true)}>
          {editing?.status === "published" ? "Save" : "Publish now"}
        </Button>
        {editing?.status !== "published" && (
          <Button type="submit" variant="secondary" loading={save.isPending}>
            Save as draft
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Announcements({ school }: { school: Institution }) {
  const [status, setStatus] = useState("");
  const list = useSchoolAnnouncements(school.id, status);
  const action = useAnnouncementAction(school.id);
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
  return (
    <Section
      title="Announcements"
      description="Official notices. Members get notified; urgent ones are sent straight away."
      actions={
        <Button leading={<Plus size={16} />} onClick={() => setEditing("new")}>
          New announcement
        </Button>
      }
    >
      {editing && (
        <AnnouncementForm
          school={school}
          editing={editing === "new" ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      )}
      <label htmlFor="ann-status" className="visually-hidden">
        Status
      </label>
      <Select id="ann-status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: "14rem" }}>
        <option value="">All</option>
        <option value="draft">Drafts</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </Select>
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} />
      ) : list.data.length === 0 ? (
        <p className="muted">No announcements yet.</p>
      ) : (
        list.data.map((a) => (
          <AnnouncementCard
            key={a.id}
            announcement={a}
            actions={
              <div className="cluster">
                <StatusBadge status={a.status} />
                <Button size="sm" variant="secondary" onClick={() => setEditing(a)}>
                  Edit
                </Button>
                {a.status !== "published" && (
                  <ActionButton
                    run={() => action.mutateAsync({ announcementId: a.id, action: "publish" })}
                    success="Published"
                  >
                    Publish
                  </ActionButton>
                )}
                {a.status === "published" && (
                  <ActionButton
                    run={() => action.mutateAsync({ announcementId: a.id, action: "archive" })}
                    success="Archived"
                  >
                    Archive
                  </ActionButton>
                )}
                <ActionButton
                  variant="danger"
                  confirm="Delete this announcement for good?"
                  run={() => action.mutateAsync({ announcementId: a.id, action: "delete" })}
                  success="Deleted"
                >
                  Delete
                </ActionButton>
              </div>
            }
          />
        ))
      )}
    </Section>
  );
}

// ------------------------------------------------------------------ profile
function Profile({ school, platformAdmin }: { school: Institution; platformAdmin: boolean }) {
  const update = useUpdateInstitution(school.id);
  const toast = useToast();
  const [form, setForm] = useState({
    name: school.name,
    short_name: school.short_name ?? "",
    website: school.website ?? "",
    description: school.description ?? "",
    founded_year: school.founded_year ? String(school.founded_year) : "",
    city: school.city ?? "",
    region: school.region ?? "",
    ownership: school.ownership ?? "",
    verification_methods: school.verification_methods ?? [],
    is_verified: Boolean(school.is_verified),
    status: school.status ?? "active",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggleMethod = (method: string) =>
    setForm((f) => ({
      ...f,
      verification_methods: f.verification_methods.includes(method)
        ? f.verification_methods.filter((x) => x !== method)
        : [...f.verification_methods, method],
    }));
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const { is_verified, status, founded_year, ...rest } = form;
    update.mutate(
      {
        ...rest,
        founded_year: founded_year ? Number(founded_year) : null,
        ...(platformAdmin ? { is_verified, status: status as Institution["status"] } : {}),
      },
      { onSuccess: () => toast.success("Saved"), onError: (e) => toast.error(errorMessage(e)) },
    );
  };
  return (
    <Section title="School profile">
      <form className={m.form} onSubmit={onSubmit}>
        <div className={m.formRow}>
          <Field label="Name">
            <Input value={form.name} onChange={set("name")} required />
          </Field>
          <Field label="Short name">
            <Input value={form.short_name} onChange={set("short_name")} />
          </Field>
        </div>
        <Field label="About">
          <Textarea rows={5} value={form.description} onChange={set("description")} />
        </Field>
        <div className={m.formRow}>
          <Field label="Website" optional>
            <Input type="url" value={form.website} onChange={set("website")} />
          </Field>
          <Field label="Founded" optional>
            <Input type="number" value={form.founded_year} onChange={set("founded_year")} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={set("city")} />
          </Field>
          <Field label="State">
            <Input value={form.region} onChange={set("region")} />
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
        </div>
        <fieldset className="stack" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 650 }}>How people can prove they belong</legend>
          {Object.entries(VERIFY_METHOD_LABELS).map(([key, label]) => (
            <Checkbox
              key={key}
              label={label}
              checked={form.verification_methods.includes(key)}
              onChange={() => toggleMethod(key)}
            />
          ))}
          <span className={m.small}>None ticked: school email and admin review are offered.</span>
        </fieldset>
        {platformAdmin && (
          <div className={m.formRow}>
            <Checkbox
              label="Verified school (official presence confirmed)"
              checked={form.is_verified}
              onChange={(e) => setForm((f) => ({ ...f, is_verified: e.target.checked }))}
            />
            <Field label="Status">
              <Select value={form.status} onChange={set("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="merged">Merged</option>
                <option value="closed">Closed</option>
              </Select>
            </Field>
          </div>
        )}
        <div>
          <Button type="submit" loading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Section>
  );
}

// ---------------------------------------------------------------- structure
interface StructureSpec {
  kind: Exclude<StructureKind, "domains">;
  title: string;
  fields: {
    name: string;
    label: string;
    type?: "text" | "number" | "date" | "select";
    options?: [string, string][];
    required?: boolean;
  }[];
  describe: (row: Record<string, unknown>) => string;
}

function StructureList<T extends { id: string; name?: string; is_active?: boolean }>({
  school,
  spec,
}: {
  school: Institution;
  spec: StructureSpec;
}) {
  const rows = useSchoolPart<T>(school.id, spec.kind);
  const add = useAddStructure(school.id);
  const edit = useEditStructure(school.id);
  const addSemester = useAddSemester(school.id);
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const body: Record<string, unknown> = {};
    for (const f of spec.fields) {
      const v = values[f.name];
      if (v === undefined || v === "") continue;
      body[f.name] = f.type === "number" ? Number(v) : v === "true" ? true : v;
    }
    add.mutate(
      { kind: spec.kind, body },
      {
        onSuccess: () => {
          setValues({});
          setAdding(false);
          toast.success("Added");
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };
  return (
    <Section
      title={spec.title}
      actions={
        <Button size="sm" variant="secondary" leading={<Plus size={14} />} onClick={() => setAdding((v) => !v)}>
          Add
        </Button>
      }
    >
      {adding && (
        <form className={m.form} onSubmit={onSubmit}>
          <div className={m.formRow}>
            {spec.fields.map((f) => (
              <Field key={f.name} label={f.label} optional={!f.required}>
                {f.type === "select" ? (
                  <Select
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  >
                    <option value="">–</option>
                    {f.options?.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    type={f.type ?? "text"}
                    required={f.required}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
          </div>
          <div>
            <Button type="submit" loading={add.isPending}>
              Save
            </Button>
          </div>
        </form>
      )}
      {rows.isPending ? (
        <Spinner />
      ) : (rows.data ?? []).length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <ul className={m.list}>
          {rows.data!.map((row) => {
            const r = row as unknown as Record<string, unknown>;
            return (
              <li key={row.id} className={m.item}>
                <div className={m.itemMain}>
                  <strong>{String(r.name ?? r.code ?? "")}</strong>
                  <span className={m.small}>{spec.describe(r)}</span>
                  {spec.kind === "sessions" && Array.isArray(r.semesters) && (
                    <span className={m.small}>
                      Semesters: {(r.semesters as { name: string }[]).map((x) => x.name).join(", ") || "none"}
                    </span>
                  )}
                </div>
                <div className={m.rowActions}>
                  {"is_active" in r && (
                    <ActionButton
                      run={() =>
                        edit.mutateAsync({ kind: spec.kind, objectId: row.id, body: { is_active: !r.is_active } })
                      }
                      success="Updated"
                    >
                      {r.is_active === false ? "Reactivate" : "Deactivate"}
                    </ActionButton>
                  )}
                  {spec.kind === "sessions" && (
                    <ActionButton
                      reason="Semester name (e.g. First semester)"
                      run={(name) =>
                        addSemester.mutateAsync({
                          sessionId: row.id,
                          body: { name: name || "Semester", order: ((r.semesters as unknown[]) ?? []).length + 1 },
                        })
                      }
                      success="Semester added"
                    >
                      Add semester
                    </ActionButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function Structure({ school }: { school: Institution }) {
  const campuses = useSchoolPart<Campus>(school.id, "campuses");
  const units = useSchoolPart<AcademicUnit>(school.id, "units");
  const campusOptions: [string, string][] = (campuses.data ?? []).map((c) => [c.id, c.name]);
  const unitOptions: [string, string][] = (units.data ?? []).map((u) => [u.id, u.name]);
  const specs: StructureSpec[] = [
    {
      kind: "campuses",
      title: "Campuses",
      fields: [
        { name: "name", label: "Name", required: true },
        { name: "city", label: "City" },
        { name: "address", label: "Address" },
      ],
      describe: (r) =>
        [r.city, r.is_main ? "Main campus" : "", r.is_active === false ? "Inactive" : ""].filter(Boolean).join(" · "),
    },
    {
      kind: "units",
      title: "Faculties, schools and departments",
      fields: [
        { name: "name", label: "Name", required: true },
        {
          name: "unit_type",
          label: "Type",
          type: "select",
          required: true,
          options: ["college", "faculty", "school", "department", "institute", "centre", "unit"].map((t) => [
            t,
            humanize(t),
          ]),
        },
        { name: "short_name", label: "Short name" },
        { name: "parent", label: "Part of", type: "select", options: unitOptions },
        { name: "campus", label: "Campus", type: "select", options: campusOptions },
      ],
      describe: (r) =>
        [humanize(String(r.unit_type ?? "")), r.is_active === false ? "Inactive" : ""].filter(Boolean).join(" · "),
    },
    {
      kind: "programmes",
      title: "Programmes",
      fields: [
        { name: "name", label: "Name", required: true },
        { name: "award", label: "Award (B.Sc., HND, NCE…)" },
        { name: "academic_unit", label: "Department", type: "select", options: unitOptions },
        { name: "duration_years", label: "Years", type: "number" },
        {
          name: "study_mode",
          label: "Mode",
          type: "select",
          options: ["full_time", "part_time", "distance", "sandwich", "online"].map((t) => [t, humanize(t)]),
        },
      ],
      describe: (r) =>
        [
          r.award,
          r.duration_years ? `${r.duration_years} years` : "",
          r.study_mode ? humanize(String(r.study_mode)) : "",
        ]
          .filter(Boolean)
          .join(" · "),
    },
    {
      kind: "levels",
      title: "Levels",
      fields: [
        { name: "name", label: "Name (e.g. 100 Level, ND1)", required: true },
        { name: "code", label: "Code", required: true },
        { name: "order", label: "Order", type: "number" },
      ],
      describe: (r) => String(r.code ?? ""),
    },
    {
      kind: "sessions",
      title: "Academic sessions",
      fields: [
        { name: "name", label: "Name (e.g. 2025/2026)", required: true },
        { name: "starts_on", label: "Starts", type: "date", required: true },
        { name: "ends_on", label: "Ends", type: "date", required: true },
        { name: "make_current", label: "Current session?", type: "select", options: [["true", "Yes"]] },
      ],
      describe: (r) =>
        [
          r.starts_on && r.ends_on ? `${formatDate(String(r.starts_on))} – ${formatDate(String(r.ends_on))}` : "",
          r.is_current ? "Current" : "",
        ]
          .filter(Boolean)
          .join(" · "),
    },
  ];
  return (
    <>
      {specs.map((spec) => (
        <StructureList<Campus | AcademicUnit | Programme | Level | AcademicSession>
          key={spec.kind}
          school={school}
          spec={spec}
        />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ domains
function Domains({ school }: { school: Institution }) {
  const domains = useSchoolPart<SchoolDomain>(school.id, "domains");
  const add = useAddStructure(school.id);
  const remove = useRemoveDomain(school.id);
  const toast = useToast();
  const [domain, setDomain] = useState("");
  const [subdomains, setSubdomains] = useState(true);
  return (
    <Section
      title="School email domains"
      description="People with an address at a verified domain can verify themselves with an emailed code. New domains are checked by GistLoop before they count."
    >
      <form
        className="cluster"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(
            { kind: "domains", body: { domain: domain.trim().toLowerCase(), allow_subdomains: subdomains } },
            {
              onSuccess: () => (setDomain(""), toast.success("Domain added")),
              onError: (err) => toast.error(errorMessage(err)),
            },
          );
        }}
      >
        <label htmlFor="domain" className="visually-hidden">
          Domain
        </label>
        <Input
          id="domain"
          placeholder="e.g. unilag.edu.ng"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        />
        <Checkbox
          label="Include subdomains (student.…)"
          checked={subdomains}
          onChange={(e) => setSubdomains(e.target.checked)}
        />
        <Button type="submit" loading={add.isPending} disabled={!domain.includes(".")}>
          Add
        </Button>
      </form>
      {domains.isPending ? (
        <Spinner />
      ) : (
        <ul className={m.list}>
          {domains.data?.map((d) => (
            <li key={d.id} className={m.item}>
              <div className={m.itemMain}>
                <strong>{d.domain}</strong>
                <span className="cluster">
                  {d.is_verified ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <Badge tone="warning">Awaiting check</Badge>
                  )}
                  {d.allow_subdomains && <span className={m.small}>and subdomains</span>}
                </span>
              </div>
              <ActionButton
                variant="danger"
                confirm={`Remove ${d.domain}?`}
                run={() => remove.mutateAsync(d.id)}
                success="Removed"
              >
                Remove
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------ the page
type Tab = "members" | "announcements" | "profile" | "structure" | "domains" | "stats";

/** /schools/:institutionId/manage: for the school's own admins (and GistLoop staff). */
export default function SchoolAdminPage() {
  const { institutionId } = useParams();
  const school = useInstitution(institutionId);
  const perms = usePermissions("institution", institutionId ?? "", Boolean(institutionId));
  const platform = usePermissions("platform", "");
  const [tab, setTab] = useState<Tab | null>(null);
  if (school.isPending || perms.isPending) return <PageLoader />;
  if (school.isError) return <ErrorState error={school.error} />;
  const tabs: { value: Tab; label: string; perm: string }[] = [
    { value: "members", label: "Members", perm: "institution.memberships.view" },
    { value: "announcements", label: "Announcements", perm: "institution.announcements.publish" },
    { value: "profile", label: "Profile", perm: "institution.edit" },
    { value: "structure", label: "Structure", perm: "institution.structure.manage" },
    { value: "domains", label: "Email domains", perm: "institution.domains.manage" },
    { value: "stats", label: "Stats", perm: "analytics.view" },
  ];
  const allowed = tabs.filter((t) => can(perms.data, t.perm));
  const s = school.data;
  const current = tab ?? allowed[0]?.value;
  return (
    <div className="stack">
      <Seo title={`Manage ${s.short_name || s.name}`} noIndex />
      <PageHeader
        eyebrow={<Link to={`/schools/${s.id}`}>← {s.name}</Link>}
        title={`Manage ${s.short_name || s.name}`}
        description="Tools for the school's own team. Everything you do here is recorded."
      />
      {allowed.length === 0 || !current ? (
        <NoAccess>Only the school's admins can manage it. GistLoop staff can grant you a school role.</NoAccess>
      ) : (
        <>
          <Tabs label="Manage sections" value={current} onChange={setTab} items={allowed} />
          {current === "members" && <Members school={s} perms={perms.data} />}
          {current === "announcements" && <Announcements school={s} />}
          {current === "profile" && <Profile school={s} platformAdmin={can(platform.data, "institution.manage")} />}
          {current === "structure" && <Structure school={s} />}
          {current === "domains" && <Domains school={s} />}
          {current === "stats" && (
            <Section title="Activity">
              <ScopeStats scopeType="institution" scopeId={s.id} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}
