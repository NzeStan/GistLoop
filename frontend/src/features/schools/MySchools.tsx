import { GraduationCap, Star } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import {
  type Institution,
  type Membership,
  ROLE_LABELS,
  useInstitution,
  useInstitutions,
  useLeaveInstitution,
  useMakePrimary,
  schoolName,
  useMyMemberships,
} from "@/api/queries/institutions";
import m from "@/components/Manage.module.css";
import { ActionButton, Section, StatusBadge } from "@/components/Manage";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useDebounced } from "@/lib/hooks";

import { JoinSchoolDialog, VerifyMembership } from "./SchoolPages";

function MembershipRow({ membership }: { membership: Membership }) {
  const school = useInstitution(membership.institution.id);
  const primary = useMakePrimary();
  const leave = useLeaveInstitution();
  const [verifying, setVerifying] = useState(false);
  const i = membership.institution;
  return (
    <li className={m.item} style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div className="cluster" style={{ justifyContent: "space-between" }}>
        <div className={m.itemMain}>
          <strong>
            <Link to={`/schools/${i.id}`}>{schoolName(i)}</Link>
          </strong>
          <span className="cluster" style={{ "--cluster-gap": "var(--space-2)" } as React.CSSProperties}>
            <span className="muted">{ROLE_LABELS[membership.role] ?? membership.role}</span>
            <StatusBadge status={membership.status} />
            {membership.is_primary && (
              <Badge tone="primary">
                <Star size={12} aria-hidden /> Main school
              </Badge>
            )}
            {membership.identifier_hint && <span className={m.small}>ID {membership.identifier_hint}</span>}
          </span>
          {membership.status_reason && <span className={m.small}>{membership.status_reason}</span>}
        </div>
        <div className={m.rowActions}>
          {membership.status !== "verified" && membership.status !== "suspended" && (
            <Button size="sm" onClick={() => setVerifying((v) => !v)}>
              {verifying ? "Hide" : "Verify"}
            </Button>
          )}
          {membership.status === "verified" && !membership.is_primary && (
            <ActionButton run={() => primary.mutateAsync(membership.id)} success="Main school updated">
              Make main school
            </ActionButton>
          )}
          <ActionButton
            variant="danger"
            confirm={`Leave ${i.short_name || i.name}? You'll lose access to its feed, gist and announcements.`}
            run={() => leave.mutateAsync(membership.id)}
            success="You left the school"
          >
            Leave
          </ActionButton>
        </div>
      </div>
      {verifying &&
        (school.data ? (
          <VerifyMembership membership={membership} methods={school.data.available_verification_methods} />
        ) : (
          <Spinner />
        ))}
    </li>
  );
}

function AddSchool() {
  const [q, setQ] = useState("");
  const search = useInstitutions({ q: useDebounced(q) });
  const [picked, setPicked] = useState<Institution | null>(null);
  return (
    <Section title="Add a school" description="Search for your university, polytechnic or college.">
      <label htmlFor="add-school" className="visually-hidden">
        Search schools
      </label>
      <Input
        id="add-school"
        type="search"
        placeholder="e.g. University of Lagos, UNIBEN, Yaba"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim().length >= 2 &&
        (search.isPending ? (
          <Spinner />
        ) : (
          <ul className={m.list}>
            {search.data?.results.slice(0, 8).map((s) => (
              <li key={s.id} className={m.item}>
                <div className={m.itemMain}>
                  <strong>{schoolName(s)}</strong>
                  <span className={m.small}>{[s.city, s.region].filter(Boolean).join(", ")}</span>
                </div>
                <Button size="sm" onClick={() => setPicked(s)}>
                  Join
                </Button>
              </li>
            ))}
            {search.data?.results.length === 0 && (
              <li className="muted">
                Not listed yet? <Link to="/contact">Tell us your school</Link> and we'll add it.
              </li>
            )}
          </ul>
        ))}
      {picked && (
        <JoinSchoolDialog school={picked} open onClose={() => setPicked(null)} onJoined={() => setPicked(null)} />
      )}
    </Section>
  );
}

/** /settings/schools: the schools you belong to, verification and your main school. */
export default function MySchoolsSettings() {
  const memberships = useMyMemberships();
  const live = (memberships.data ?? []).filter((x) => !["left", "revoked"].includes(x.status));
  return (
    <>
      <Section
        title="Your schools"
        description="Verified members see their school's feed, anonymous gist and announcements. Your main school shows on your profile."
      >
        {memberships.isPending ? (
          <Spinner />
        ) : memberships.isError ? (
          <ErrorState error={memberships.error} onRetry={() => void memberships.refetch()} />
        ) : live.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No school yet">
            Add the school you attend or work at below.
          </EmptyState>
        ) : (
          <ul className={m.list}>
            {live.map((x) => (
              <MembershipRow key={x.id} membership={x} />
            ))}
          </ul>
        )}
      </Section>
      <AddSchool />
    </>
  );
}
