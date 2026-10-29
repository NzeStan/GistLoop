import { BadgeCheck, Megaphone, Pin } from "lucide-react";

import { useMyAnnouncements } from "@/api/queries/opportunities";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import styles from "@/features/content/Lists.module.css";
import { formatDateTime, humanize, timeAgo } from "@/lib/format";

const PRIORITY_TONE = { normal: "neutral", important: "warning", urgent: "danger" } as const;

/** /announcements: official notices from the institutions you belong to. */
export default function AnnouncementsPage() {
  const announcements = useMyAnnouncements();
  return (
    <>
      <Seo title="Announcements" noIndex />
      <PageHeader
        title="Announcements"
        description="Official notices from your institution: exams, admissions, welfare, security and more."
      />
      {announcements.isPending ? (
        <Spinner />
      ) : announcements.isError ? (
        <ErrorState error={announcements.error} onRetry={() => void announcements.refetch()} />
      ) : announcements.data.results.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements">
          Notices from your institution show up here once your school is on GistLoop and you're a verified member.
        </EmptyState>
      ) : (
        <ul className={styles.list}>
          {announcements.data.results.map((a) => (
            <li key={a.id}>
              <Card className={a.priority === "urgent" ? styles.unread : undefined}>
                <article className="stack">
                  <div className={styles.row}>
                    <span className="cluster">
                      <strong>{a.institution.name}</strong>
                      {a.institution.is_verified && <BadgeCheck size={16} aria-label="Verified institution" />}
                    </span>
                    <span className="cluster">
                      {a.pinned && (
                        <Badge>
                          <Pin size={12} aria-hidden /> Pinned
                        </Badge>
                      )}
                      {a.priority !== "normal" && (
                        <Badge tone={PRIORITY_TONE[a.priority]}>{humanize(a.priority)}</Badge>
                      )}
                      <Badge tone="primary">{humanize(a.category)}</Badge>
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
                </article>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
