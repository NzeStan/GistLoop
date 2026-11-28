import { BadgeCheck, Megaphone, Pin } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import type { Announcement } from "@/api/queries/institutions";
import { useMyAnnouncements } from "@/api/queries/opportunities";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import styles from "@/features/content/Lists.module.css";
import { formatDateTime, humanize, timeAgo } from "@/lib/format";

const PRIORITY_TONE = { normal: "neutral", important: "warning", urgent: "danger" } as const;

export function AnnouncementCard({ announcement: a, actions }: { announcement: Announcement; actions?: ReactNode }) {
  return (
    <Card className={a.priority === "urgent" ? styles.unread : undefined}>
      <article className="stack">
        <div className={styles.row}>
          <span className="cluster">
            <Link to={`/schools/${a.institution.id}`}>
              <strong>{a.institution.name}</strong>
            </Link>
            {a.institution.is_verified && <BadgeCheck size={16} aria-label="Verified institution" />}
          </span>
          <span className="cluster">
            {a.pinned && (
              <Badge>
                <Pin size={12} aria-hidden /> Pinned
              </Badge>
            )}
            {a.priority !== "normal" && <Badge tone={PRIORITY_TONE[a.priority]}>{humanize(a.priority)}</Badge>}
            <Badge tone="primary">{humanize(a.category)}</Badge>
            {a.audience === "members" && <Badge>Members only</Badge>}
          </span>
        </div>
        <h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>{a.title}</h2>
        <p className={styles.body} style={{ margin: 0 }}>
          {a.body}
        </p>
        {a.published_at && (
          <time className="muted" dateTime={a.published_at} title={formatDateTime(a.published_at)}>
            {timeAgo(a.published_at)}
          </time>
        )}
        {actions}
      </article>
    </Card>
  );
}

/** /announcements: official notices from the institutions you belong to. */
export default function AnnouncementsPage() {
  const announcements = useMyAnnouncements();
  return (
    <>
      <Seo title="Announcements" noIndex />
      <PageHeader
        title="Announcements"
        description="Official notices from your schools: exams, admissions, welfare, security and more."
      />
      {announcements.isPending ? (
        <Spinner />
      ) : announcements.isError ? (
        <ErrorState error={announcements.error} onRetry={() => void announcements.refetch()} />
      ) : announcements.data.results.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements"
          action={<ButtonLink to="/settings/schools">Add your school</ButtonLink>}
        >
          Notices from your school show up here once you're a verified member.
        </EmptyState>
      ) : (
        <ul className={styles.list}>
          {announcements.data.results.map((a) => (
            <li key={a.id}>
              <AnnouncementCard announcement={a} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
