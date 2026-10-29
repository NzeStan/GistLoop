import { CalendarDays, Link as LinkIcon, Settings, Store } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";

import { errorMessage } from "@/api/errors";
import { useProfile } from "@/api/queries/account";
import { useFollow, useUserPosts } from "@/api/queries/social";
import { useAuth } from "@/auth/AuthProvider";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { PostList } from "@/features/feed/PostList";
import { formatCount } from "@/lib/format";
import { safeUrl } from "@/lib/links";

import styles from "./Profile.module.css";

export default function ProfilePage() {
  const { handle } = useParams();
  const { me, status } = useAuth();
  const profile = useProfile(handle);
  const posts = useUserPosts(profile.data?.id);
  const follow = useFollow();
  const toast = useToast();

  if (profile.isPending) return <PageLoader />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;

  const p = profile.data;
  const social = p.extras.social;
  const relationship = social?.relationship?.following ?? null;
  const isMe = me?.id === p.id;
  const website = safeUrl(social?.website);
  const joined = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(p.created_at));

  const onFollow = () =>
    follow.mutate(
      { userId: p.id, following: relationship !== null },
      {
        onSuccess: (result) => {
          const state = (result as { status?: string } | undefined)?.status;
          toast.success(
            relationship
              ? `Unfollowed ${p.display_name}`
              : state === "pending"
                ? "Follow request sent"
                : `Following ${p.display_name}`,
          );
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <div className="stack">
      <Seo title={`${p.display_name} (@${p.handle})`} description={social?.bio || `${p.display_name} on GistLoop`} />
      <Card padded={false} className={styles.card}>
        <div className={styles.banner} aria-hidden />
        <div className={styles.head}>
          <Avatar name={p.display_name} seed={p.id} src={p.avatar_url} size="xl" className={styles.avatar} />
          <div className={styles.actions}>
            {isMe ? (
              <ButtonLink to="/settings" variant="secondary" leading={<Settings size={16} />}>
                Edit profile
              </ButtonLink>
            ) : status === "signed-in" ? (
              <Button variant={relationship ? "secondary" : "primary"} loading={follow.isPending} onClick={onFollow}>
                {relationship === "active" ? "Following" : relationship === "pending" ? "Requested" : "Follow"}
              </Button>
            ) : (
              <ButtonLink to={`/login?next=/u/${p.handle}`}>Follow</ButtonLink>
            )}
          </div>
        </div>
        <div className={styles.info}>
          <h1 className={styles.name}>{p.display_name}</h1>
          <p className="muted">
            @{p.handle}
            {social?.relationship?.followed_by && <Badge className={styles.followsYou}>Follows you</Badge>}
          </p>
          {social?.bio && <p className={styles.bio}>{social.bio}</p>}
          <div className={styles.meta}>
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer nofollow">
                <LinkIcon size={14} aria-hidden /> {website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            )}
            <span>
              <CalendarDays size={14} aria-hidden /> Joined {joined}
            </span>
            {p.extras.seller && p.extras.seller.sales_count > 0 && (
              <span>
                <Store size={14} aria-hidden /> {p.extras.seller.sales_count} sales
              </span>
            )}
          </div>
          {social && (
            <div className={styles.counts}>
              <span>
                <strong>{formatCount(social.posts_count)}</strong> posts
              </span>
              <span>
                <strong>{formatCount(social.followers_count)}</strong> followers
              </span>
              <span>
                <strong>{formatCount(social.following_count)}</strong> following
              </span>
            </div>
          )}
          {p.extras.communities && p.extras.communities.length > 0 && (
            <div className={styles.communities}>
              {p.extras.communities.slice(0, 8).map((c) => (
                <Link key={c.id} to={`/c/${c.id}`}>
                  <Badge tone={c.role === "member" ? "neutral" : "primary"}>{c.name}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>
      <h2 className="visually-hidden">Posts</h2>
      <PostList
        query={posts}
        empty={{
          title: isMe ? "You haven't posted yet" : "No posts yet",
          body: isMe ? "Share your first gist from the home feed." : undefined,
        }}
      />
    </div>
  );
}

/** /creators/:handle (links from the creator module) → the person's profile. */
export function CreatorRedirect() {
  const { handle } = useParams();
  return <Navigate to={`/u/${handle}`} replace />;
}
