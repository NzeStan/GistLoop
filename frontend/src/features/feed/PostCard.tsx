import { Bookmark, Flag, Heart, Megaphone, MessageCircle, MoreHorizontal, Repeat2, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { errorMessage } from "@/api/errors";
import { useDeletePost, useToggleBookmark, useToggleReaction, useToggleRepost, useVote } from "@/api/queries/social";
import type { Post } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { RichText } from "@/components/RichText";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { formatCount, formatDateTime, timeAgo } from "@/lib/format";

import styles from "./Post.module.css";
import { ReportDialog } from "./ReportDialog";

function PollView({ post }: { post: Post }) {
  const vote = useVote(post.id);
  const toast = useToast();
  const poll = post.poll!;
  const voted = poll.options.some((o) => o.voted);
  const showResults = voted || poll.closed;
  return (
    <div className={styles.poll}>
      {poll.options.map((option) => {
        const share = poll.total_votes ? Math.round((option.vote_count / poll.total_votes) * 100) : 0;
        return (
          <button
            key={option.id}
            type="button"
            className={styles.pollOption}
            disabled={showResults || vote.isPending}
            aria-pressed={option.voted}
            onClick={() => vote.mutate([option.id], { onError: (e) => toast.error(errorMessage(e)) })}
          >
            {showResults && <span className={styles.pollBar} style={{ width: `${share}%` }} aria-hidden />}
            <span>{option.text}</span>
            {showResults && <strong>{share}%</strong>}
          </button>
        );
      })}
      <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
        {formatCount(poll.total_votes)} votes{poll.closed ? " · Final results" : ""}
      </span>
    </div>
  );
}

export function PostCard({ post, linkToDetail = true }: { post: Post; linkToDetail?: boolean }) {
  const { status } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const react = useToggleReaction();
  const bookmark = useToggleBookmark();
  const repost = useToggleRepost();
  const remove = useDeletePost();
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const signedIn = status === "signed-in";
  const requireAuth = (action: () => void) => () => (signedIn ? action() : navigate(`/login?next=/posts/${post.id}`));
  const href = `/posts/${post.id}`;
  const profile = post.author.handle ? `/u/${post.author.handle}` : undefined;

  const share = async () => {
    const url = `${window.location.origin}${href}`;
    try {
      if (navigator.share) await navigator.share({ url, title: `${post.author.display_name} on GistLoop` });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* Share sheet dismissed */
    }
  };

  return (
    <article className={styles.card} aria-labelledby={`post-${post.id}-author`}>
      <Avatar name={post.author.display_name} seed={post.author.id} src={post.author.avatar_url} />
      <div className={styles.content}>
        <div className={styles.meta}>
          {profile ? (
            <Link id={`post-${post.id}-author`} to={profile} className={styles.name}>
              {post.author.display_name}
            </Link>
          ) : (
            <span id={`post-${post.id}-author`} className={styles.name}>
              {post.author.display_name}
            </span>
          )}
          {post.author.handle && <span className={styles.handle}>@{post.author.handle}</span>}
          <span aria-hidden className={styles.handle}>
            ·
          </span>
          <Link to={href} className={styles.time}>
            <time dateTime={post.created_at} title={formatDateTime(post.created_at)}>
              {timeAgo(post.created_at)}
            </time>
          </Link>
          {post.edited_at && <span className={styles.handle}>(edited)</span>}
          <div className={styles.more}>
            <Button
              variant="ghost"
              icon
              size="sm"
              aria-label="More options"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
            >
              <MoreHorizontal size={18} />
            </Button>
          </div>
        </div>

        {menu && (
          <div className="cluster" style={{ "--cluster-gap": "var(--space-2)" } as React.CSSProperties}>
            {post.viewer.is_author ? (
              <>
                {post.visibility === "public" && !post.is_repost && (
                  <ButtonLink
                    size="sm"
                    variant="secondary"
                    leading={<Megaphone size={14} />}
                    to={`/promote/new?type=social.post&id=${post.id}`}
                  >
                    Boost
                  </ButtonLink>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  leading={<Trash2 size={14} />}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                leading={<Flag size={14} />}
                onClick={requireAuth(() => setReporting(true))}
              >
                Report
              </Button>
            )}
          </div>
        )}

        {post.status && post.status !== "published" && (
          <Badge tone="warning" className={styles.status}>
            {post.status === "hidden" ? "Hidden by moderators" : post.status}
          </Badge>
        )}

        {post.body && <RichText text={post.body} className={styles.body} />}

        {post.media.length > 0 && (
          <div className={styles.media}>
            {post.media.map((m) => (
              <img key={m.id} src={m.url} alt={m.alt_text || "Image attached to the post"} loading="lazy" />
            ))}
          </div>
        )}

        {post.poll && <PollView post={post} />}

        {post.repost_of && (
          <div className={styles.repost}>
            {post.repost_of.unavailable ? (
              <span className="muted">This post is unavailable.</span>
            ) : (
              <Link to={`/posts/${post.repost_of.id}`}>
                <strong>{post.repost_of.author?.display_name}</strong>
                <span className="muted"> · {post.repost_of.body?.slice(0, 160)}</span>
              </Link>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <Link to={href} className={styles.action} aria-label={`${post.counts.comments} comments`}>
            <MessageCircle size={18} aria-hidden /> {formatCount(post.counts.comments)}
          </Link>
          <button
            type="button"
            className={styles.action}
            aria-pressed={post.viewer.reposted}
            aria-label={post.viewer.reposted ? "Undo repost" : "Repost"}
            onClick={requireAuth(() => repost.mutate(post, { onError: (e) => toast.error(errorMessage(e)) }))}
          >
            <Repeat2 size={18} aria-hidden /> {formatCount(post.counts.reposts)}
          </button>
          <button
            type="button"
            className={styles.action}
            aria-pressed={Boolean(post.viewer.reaction)}
            aria-label={post.viewer.reaction ? "Unlike" : "Like"}
            onClick={requireAuth(() => react.mutate({ post }, { onError: (e) => toast.error(errorMessage(e)) }))}
          >
            <Heart size={18} aria-hidden /> {formatCount(post.counts.reactions)}
          </button>
          <button
            type="button"
            className={styles.action}
            aria-pressed={post.viewer.bookmarked}
            aria-label={post.viewer.bookmarked ? "Remove bookmark" : "Bookmark"}
            onClick={requireAuth(() => bookmark.mutate(post))}
          >
            <Bookmark size={18} aria-hidden />
          </button>
          <button type="button" className={styles.action} aria-label="Share" onClick={share}>
            <Share2 size={18} aria-hidden />
          </button>
        </div>
      </div>

      <ReportDialog open={reporting} onClose={() => setReporting(false)} contentType="social.post" objectId={post.id} />
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this post?">
        <div className="stack">
          <p className="muted">This can't be undone. It will disappear from your profile and everyone's feeds.</p>
          <div className="cluster" style={{ justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(post.id, {
                  onSuccess: () => {
                    setConfirmDelete(false);
                    toast.success("Post deleted");
                    if (!linkToDetail) navigate("/feed");
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </article>
  );
}

export function PostSkeleton() {
  return (
    <div className={styles.skeletonCard} aria-hidden>
      <Skeleton width="2.5rem" height="2.5rem" radius="50%" />
      <div className="stack" style={{ flex: 1, "--stack-gap": "var(--space-2)" } as React.CSSProperties}>
        <Skeleton width="40%" />
        <Skeleton />
        <Skeleton width="75%" />
      </div>
    </div>
  );
}
