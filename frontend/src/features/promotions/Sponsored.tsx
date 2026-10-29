import { ArrowUpRight, Megaphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import {
  type Placement,
  type PromotedItem,
  recordClick,
  recordImpression,
  useSponsored,
} from "@/api/queries/monetization";
import { usePost } from "@/api/queries/social";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { PostCard } from "@/features/feed/PostCard";
import { humanize } from "@/lib/format";
import { CONTENT_LABELS, contentHref, safeUrl } from "@/lib/links";

import styles from "./Sponsored.module.css";

/** Counts an impression once at least half of the element has been on screen. */
function useImpression<T extends Element>(token: string) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          recordImpression(token);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [token]);
  return ref;
}

const CTA: Record<string, string> = {
  learn_more: "Learn more",
  sign_up: "Sign up",
  shop_now: "Shop now",
  register: "Register",
  apply: "Apply",
  listen: "Listen",
};

/**
 * Sponsored items for a placement, always labelled. Renders nothing when there are none (or the
 * API is unavailable), and the API sends none to members whose plan removes adverts.
 */
export function Sponsored({ placement, max = 1 }: { placement: Placement; max?: number }) {
  const items = useSponsored(placement);
  if (!items.data?.length) return null;
  return (
    <div className="stack">
      {items.data.slice(0, max).map((item) => (
        <SponsoredItem key={item.token} item={item} />
      ))}
    </div>
  );
}

function SponsoredItem({ item }: { item: PromotedItem }) {
  if (item.content?.type === "social.post") return <BoostedPost item={item} postId={item.content.id} />;
  return item.creative ? <AdCard item={item} /> : <BoostCard item={item} />;
}

function Label({ item }: { item: PromotedItem }) {
  return (
    <div className={styles.label}>
      <Badge tone="accent">
        <Megaphone size={12} aria-hidden /> {item.label}
      </Badge>
      <span className="muted">{item.advertiser.display_name}</span>
    </div>
  );
}

function AdCard({ item }: { item: PromotedItem }) {
  const ref = useImpression<HTMLDivElement>(item.token);
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const creative = item.creative!;
  const image = safeUrl(creative.image_url) ?? (creative.image_url?.startsWith("/") ? creative.image_url : null);

  // The destination comes back from the click endpoint, which also counts the click.
  const open = async () => {
    setOpening(true);
    try {
      const result = await recordClick(item.token);
      const url = safeUrl(result.destination_url);
      if (url) window.location.assign(url);
      else setOpening(false);
    } catch {
      setOpening(false);
      toast.error("That link isn't available any more.");
    }
  };

  return (
    <div ref={ref}>
      <Card className={styles.card}>
        <Label item={item} />
        <div className={styles.ad}>
          {image && <img src={image} alt="" className={styles.image} loading="lazy" />}
          <div className={styles.text}>
            <strong>{creative.headline}</strong>
            {creative.body && <p>{creative.body}</p>}
            <div>
              <Button size="sm" variant="secondary" loading={opening} onClick={() => void open()}>
                {CTA[creative.call_to_action] ?? "Learn more"} <ArrowUpRight size={14} aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BoostCard({ item }: { item: PromotedItem }) {
  const ref = useImpression<HTMLDivElement>(item.token);
  const content = item.content;
  const href = content ? contentHref(content.type, content.id) : null;
  if (!content || !href) return null;
  const label = CONTENT_LABELS[content.type] ?? humanize(content.type.split(".").pop() ?? "item");
  return (
    <div ref={ref}>
      <Card className={styles.card}>
        <Label item={item} />
        <div className={styles.boost}>
          <Avatar
            name={item.advertiser.display_name}
            seed={item.advertiser.id}
            src={item.advertiser.avatar_url}
            size="sm"
          />
          <span>
            {item.advertiser.display_name} is promoting a {label.toLowerCase()}.
          </span>
          <Link to={href} onClick={() => void recordClick(item.token).catch(() => undefined)}>
            View {label.toLowerCase()}
          </Link>
        </div>
      </Card>
    </div>
  );
}

function BoostedPost({ item, postId }: { item: PromotedItem; postId: string }) {
  const ref = useImpression<HTMLDivElement>(item.token);
  const post = usePost(postId);
  const clicked = useRef(false);
  if (!post.data) return null;
  return (
    // Any click into the promoted post counts once (the post's own links do the navigating).
    <div
      ref={ref}
      className="stack"
      style={{ "--stack-gap": "var(--space-2)" } as React.CSSProperties}
      onClickCapture={() => {
        if (clicked.current) return;
        clicked.current = true;
        void recordClick(item.token).catch(() => undefined);
      }}
    >
      <Label item={item} />
      <PostCard post={post.data} />
    </div>
  );
}
