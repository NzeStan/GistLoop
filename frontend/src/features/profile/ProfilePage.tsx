import { useRecordView } from "@/api/queries/analytics";
import {
  Ban,
  CalendarDays,
  GraduationCap,
  Link as LinkIcon,
  MessageCircleQuestion,
  MessagesSquare,
  MoreHorizontal,
  Settings,
  ShieldMinus,
  Store,
  VolumeX,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { errorMessage } from "@/api/errors";
import { useProfile } from "@/api/queries/account";
import { type Relation, useRelationList, useSetRelation } from "@/api/queries/relationships";
import { useFollow, useUserPosts } from "@/api/queries/social";
import { useAuth } from "@/auth/AuthProvider";
import { Seo } from "@/components/Seo";
import { ShareMenu } from "@/components/ShareMenu";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { PostList } from "@/features/feed/PostList";
import { formatCount } from "@/lib/format";
import { ROLE_LABELS } from "@/api/queries/institutions";
import { safeUrl } from "@/lib/links";

import styles from "./Profile.module.css";

const RELATIONS: { relation: Relation; on: string; off: string; icon: typeof Ban; explain: string }[] = [
  {
    relation: "mute",
    on: "Mute",
    off: "Unmute",
    icon: VolumeX,
    explain: "You won't see their posts in your feeds. They won't know.",
  },
  {
    relation: "restrict",
    on: "Restrict",
    off: "Unrestrict",
    icon: ShieldMinus,
    explain: "Their comments on your posts are only visible to them, and they can't message you without a request.",
  },
  {
    relation: "block",
    on: "Block",
    off: "Unblock",
    icon: Ban,
    explain: "Neither of you can see or interact with the other. Following stops on both sides.",
  },
];

/** Mute, restrict or block someone (each list is checked so the button says the right thing). */
function SafetyMenu({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const blocks = useRelationList("block", open);
  const mutes = useRelationList("mute", open);
  const restricts = useRelationList("restrict", open);
  const set = useSetRelation();
  const toast = useToast();
  const lists = { block: blocks.data, mute: mutes.data, restrict: restricts.data };
  return (
    <>
      <Button variant="ghost" icon aria-label={`More options for ${name}`} onClick={() => setOpen(true)}>
        <MoreHorizontal size={18} />
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`${name}: privacy and safety`}>
        <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
          {RELATIONS.map(({ relation, on, off, icon: Icon, explain }) => {
            const active = Boolean(lists[relation]?.some((u) => u.id === userId));
            return (
              <li key={relation} className="cluster" style={{ justifyContent: "space-between" }}>
                <span style={{ flex: "1 1 14rem" }}>
                  <strong>
                    <Icon size={16} aria-hidden /> {active ? `${off} ${name}` : `${on} ${name}`}
                  </strong>
                  <br />
                  <span className="muted" style={{ fontSize: "var(--text-sm)" }}>
                    {explain}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={relation === "block" && !active ? "danger" : "secondary"}
                  loading={set.isPending && set.variables?.relation === relation}
                  disabled={lists[relation] === undefined}
                  onClick={() =>
                    set.mutate(
                      { userId, relation, on: !active },
                      {
                        onSuccess: () => toast.success(`${active ? off : on}${relation === "mute" ? "d" : "ed"}`),
                        onError: (e) => toast.error(errorMessage(e)),
                      },
                    )
                  }
                >
                  {active ? off : on}
                </Button>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </>
  );
}

export default function ProfilePage() {
  const { handle } = useParams();
  const { me, status } = useAuth();
  const profile = useProfile(handle);
  const posts = useUserPosts(profile.data?.id);
  useRecordView("users.user", profile.data?.id);
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
              <>
                <ShareMenu title={`${p.display_name} (@${p.handle})`} path={`/u/${p.handle}`} compact variant="ghost" />
                <SafetyMenu userId={p.id} name={p.display_name} />
                <ButtonLink
                  to={`/u/${p.handle}/ask`}
                  variant="ghost"
                  icon
                  aria-label={`Ask ${p.display_name} anonymously`}
                  title="Ask anonymously"
                >
                  <MessageCircleQuestion size={18} />
                </ButtonLink>
                <ButtonLink
                  to={`/messages/new?to=${encodeURIComponent(p.handle ?? "")}`}
                  variant="secondary"
                  icon
                  aria-label={`Message ${p.display_name}`}
                  title="Message"
                >
                  <MessagesSquare size={18} />
                </ButtonLink>
                <Button variant={relationship ? "secondary" : "primary"} loading={follow.isPending} onClick={onFollow}>
                  {relationship === "active" ? "Following" : relationship === "pending" ? "Requested" : "Follow"}
                </Button>
              </>
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
              <Link to={`/u/${p.handle}/followers`}>
                <strong>{formatCount(social.followers_count)}</strong> followers
              </Link>
              <Link to={`/u/${p.handle}/following`}>
                <strong>{formatCount(social.following_count)}</strong> following
              </Link>
            </div>
          )}
          {p.extras.institutions && p.extras.institutions.length > 0 && (
            <div className={styles.communities}>
              {p.extras.institutions.map((i) => (
                <Link key={i.institution_id} to={`/schools/${i.institution_id}`}>
                  <Badge tone="primary">
                    <GraduationCap size={12} aria-hidden /> {i.short_name || i.name}
                    {i.role !== "student" && ` · ${ROLE_LABELS[i.role] ?? i.role}`}
                  </Badge>
                </Link>
              ))}
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
