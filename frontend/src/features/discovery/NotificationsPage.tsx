import { BellOff, CheckCheck, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";

import {
  useMarkAllRead,
  useMarkNotification,
  useMarkSeen,
  useNotification,
  useNotifications,
} from "@/api/queries/discovery";
import type { Notification } from "@/api/types";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { contentHref } from "@/lib/links";

import styles from "./Discovery.module.css";

const targetOf = (n: Notification) =>
  !n.target || n.target.available === false ? null : contentHref(n.target.type, n.target.id);

export default function NotificationsPage() {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const list = useNotifications(tab === "unread");
  const mark = useMarkNotification();
  const markAll = useMarkAllRead();
  const seen = useMarkSeen();
  const navigate = useNavigate();

  // Opening the page clears the "new" badge (unread items stay highlighted until opened).
  const { mutate: markSeen } = seen;
  useEffect(() => markSeen(), [markSeen]);

  const open = (n: Notification) => {
    if (!n.is_read) mark.mutate({ id: n.id, read: true });
    const href = targetOf(n);
    if (href) navigate(href);
  };

  const items = list.data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <div>
      <Seo title="Notifications" noIndex />
      <PageHeader
        title="Notifications"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              leading={<CheckCheck size={16} />}
              loading={markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              Mark all read
            </Button>
            <ButtonLink to="/settings/notifications" variant="ghost" size="sm" icon aria-label="Notification settings">
              <Settings size={16} />
            </ButtonLink>
          </>
        }
      />
      <Tabs
        label="Filter notifications"
        value={tab}
        onChange={setTab}
        items={[
          { value: "all", label: "All" },
          { value: "unread", label: "Unread" },
        ]}
      />
      <Card padded={false} style={{ marginTop: "var(--space-4)", overflow: "hidden" }}>
        {list.isPending ? (
          <div style={{ padding: "var(--space-8)", display: "grid", placeItems: "center" }}>
            <Spinner />
          </div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={BellOff} title={tab === "unread" ? "You're all caught up" : "No notifications yet"}>
            Likes, comments, follows and community updates will appear here.
          </EmptyState>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={cn(styles.notification, !n.is_read && styles.unread)}
                  onClick={() => open(n)}
                >
                  <Avatar
                    name={n.actor?.display_name ?? "GistLoop"}
                    seed={n.actor?.id}
                    src={n.actor?.avatar_url}
                    size="sm"
                  />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontWeight: n.is_read ? 500 : 700 }}>{n.title}</span>
                    <time className="muted" dateTime={n.last_activity_at} style={{ fontSize: "var(--text-xs)" }}>
                      {timeAgo(n.last_activity_at)}
                    </time>
                  </span>
                  {!n.is_read && <span className={styles.dot} aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <LoadMore hasMore={list.hasNextPage} loading={list.isFetchingNextPage} onLoad={() => void list.fetchNextPage()} />
    </div>
  );
}

/** Links in notification emails point here: mark read, then go to what it's about. */
export function NotificationOpenPage() {
  const { notificationId } = useParams();
  const notification = useNotification(notificationId);
  const mark = useMarkNotification();
  const { mutate } = mark;

  useEffect(() => {
    if (notification.data && !notification.data.is_read) mutate({ id: notification.data.id, read: true });
  }, [notification.data, mutate]);

  if (notification.isPending) return <PageLoader />;
  if (notification.isError) return <Navigate to="/notifications" replace />;
  return <Navigate to={targetOf(notification.data) ?? "/notifications"} replace />;
}
