import { Flame, Hash } from "lucide-react";
import { Link } from "react-router";

import { useTrending } from "@/api/queries/discovery";
import { useHashtags } from "@/api/queries/social";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Spinner";
import { brand } from "@/config/brand";
import { CONTENT_LABELS, contentHref } from "@/lib/links";

import styles from "./Discovery.module.css";

export function TrendingList({ limit = 6 }: { limit?: number }) {
  const trending = useTrending(undefined, limit);
  if (trending.isPending) {
    return (
      <div className="stack" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height="2.5rem" />
        ))}
      </div>
    );
  }
  const items = (trending.data ?? []).filter((item) => contentHref(item.content_type, item.object_id));
  if (items.length === 0) return <p className="muted">Nothing is trending yet. Start a conversation!</p>;
  return (
    <ol className={styles.trending}>
      {items.map((item, index) => (
        <li key={`${item.content_type}:${item.object_id}`}>
          <Link to={contentHref(item.content_type, item.object_id)!} className={styles.trendingItem}>
            <span className={styles.rank}>{index + 1}</span>
            <span className={styles.trendingText}>
              <span className={styles.trendingType}>{CONTENT_LABELS[item.content_type] ?? "Trending"}</span>
              <span className={styles.trendingTitle}>{item.title}</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function TrendingRail() {
  const hashtags = useHashtags();
  return (
    <div className="stack">
      <Card>
        <h2 className={styles.railTitle}>
          <Flame size={18} aria-hidden /> Trending now
        </h2>
        <TrendingList />
      </Card>
      {hashtags.data && hashtags.data.length > 0 && (
        <Card>
          <h2 className={styles.railTitle}>
            <Hash size={18} aria-hidden /> Popular tags
          </h2>
          <ul className={styles.tags}>
            {hashtags.data.slice(0, 12).map((tag) => (
              <li key={tag.name}>
                <Link to={`/tags/${encodeURIComponent(tag.name)}`}>#{tag.name}</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className={styles.railFoot}>
        <Link to="/about">About</Link> · <Link to="/guidelines">Guidelines</Link> · <Link to="/privacy">Privacy</Link> ·{" "}
        <Link to="/terms">Terms</Link> · <Link to="/help">Help</Link>
        <br />© {new Date().getFullYear()} {brand.name}
      </p>
    </div>
  );
}
