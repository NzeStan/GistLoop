import {
  Bookmark,
  EyeOff,
  Flag,
  Heart,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquareOff,
  MoreHorizontal,
  Pencil,
  Quote,
  Repeat2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { errorMessage } from "@/api/errors";
import { can, usePermissions } from "@/api/queries/institutions";
import { useModerateContent } from "@/api/queries/relationships";
import {
  useDeletePost,
  useEditPost,
  useQuotePost,
  useToggleBookmark,
  useToggleReaction,
  useToggleRepost,
  useVote,
} from "@/api/queries/social";
import type { Post } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { RichText } from "@/components/RichText";
import { ShareMenu } from "@/components/ShareMenu";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Alert, Field, Textarea } from "@/components/ui/Form";
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
  const [picked, setPicked] = useState<string[]>([]);
  const choose = (id: string) =>
    poll.allows_multiple
      ? setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
      : vote.mutate([id], { onError: (e) => toast.error(errorMessage(e)) });
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
            aria-pressed={option.voted || picked.includes(option.id)}
            onClick={() => choose(option.id)}
          >
            {showResults && <span className={styles.pollBar} style={{ width: `${share}%` }} aria-hidden />}
            <span>{option.text}</span>
            {showResults && <strong>{share}%</strong>}
          </button>
        );
      })}
      {poll.allows_multiple && !showResults && (
        <Button
          size="sm"
          disabled={picked.length === 0}
          loading={vote.isPending}
          onClick={() => vote.mutate(picked, { onError: (e) => toast.error(errorMessage(e)) })}
        >
          Vote
        </Button>
      )}
      <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
        {formatCount(poll.total_votes)} votes
        {poll.closed ? " · Final results" : poll.closes_at ? ` · Closes ${timeAgo(poll.closes_at)}` : ""}
      </span>
    </div>
  );
}

function EditDialog({ post, open, onClose }: { post: Post; open: boolean; onClose: () => void }) {
  const edit = useEditPost();
  const toast = useToast();
  const [body, setBody] = useState(post.body);
  return (
    <Dialog open={open} onClose={onClose} title="Edit post">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          edit.mutate({ id: post.id, body: { body } }, { onSuccess: () => (onClose(), toast.success("Post updated")) });
        }}
      >
        <Field label="Your post">
          <Textarea rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {edit.isError && <Alert tone="error">{errorMessage(edit.error)}</Alert>}
        <div className="cluster" style={{ justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={edit.isPending} disabled={!body.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function QuoteDialog({ post, open, onClose }: { post: Post; open: boolean; onClose: () => void }) {
  const quote = useQuotePost();
  const toast = useToast();
  const [body, setBody] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Quote this post">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          quote.mutate({ id: post.id, body }, { onSuccess: () => (onClose(), setBody(""), toast.success("Posted")) });
        }}
      >
        <Field label="Add your take">
          <Textarea rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className={styles.repost}>
          <strong>{post.author.display_name}</strong>
          <span className="muted"> · {post.body.slice(0, 160)}</span>
        </div>
        {quote.isError && <Alert tone="error">{errorMessage(quote.error)}</Alert>}
        <div className="cluster" style={{ justifyContent: "flex-end" }}>
          <Button type="submit" loading={quote.isPending} disabled={!body.trim()}>
            Post
          </Button>
        </div>
      </form>
    </Dialog>
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
  const edit = useEditPost();
  const moderate = useModerateContent();
  const signedIn = status === "signed-in";
  const perms = usePermissions("platform", "", signedIn);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [quoting, setQuoting] = useState(false);

  const requireAuth = (action: () => void) => () => (signedIn ? action() : navigate(`/login?next=/posts/${post.id}`));
  const href = `/posts/${post.id}`;
  const profile = post.author.handle ? `/u/${post.author.handle}` : undefined;
  const moderator = can(perms.data, "social.content.moderate");
  const hidden = post.status === "hidden";

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
                {!post.is_repost && (
                  <Button size="sm" variant="secondary" leading={<Pencil size={14} />} onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  leading={<MessageSquareOff size={14} />}
                  loading={edit.isPending}
                  onClick={() =>
                    edit.mutate(
                      { id: post.id, body: { comments_enabled: !post.comments_enabled } },
                      {
                        onSuccess: () =>
                          toast.success(post.comments_enabled ? "Comments turned off" : "Comments turned on"),
                        onError: (e) => toast.error(errorMessage(e)),
                      },
                    )
                  }
                >
                  {post.comments_enabled ? "Turn off comments" : "Turn on comments"}
                </Button>
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
            {moderator && (
              <Button
                size="sm"
                variant="secondary"
                leading={hidden ? <RotateCcw size={14} /> : <EyeOff size={14} />}
                loading={moderate.isPending}
                onClick={() =>
                  moderate.mutate(
                    { kind: "posts", id: post.id, action: hidden ? "restore" : "hide" },
                    {
                      onSuccess: () => toast.success(hidden ? "Restored" : "Hidden from everyone"),
                      onError: (e) => toast.error(errorMessage(e)),
                    },
                  )
                }
              >
                {hidden ? "Restore (moderator)" : "Hide (moderator)"}
              </Button>
            )}
          </div>
        )}

        {post.status && post.status !== "published" && (
          <Badge tone="warning" className={styles.status}>
            {hidden ? "Hidden by moderators" : post.status}
          </Badge>
        )}

        {post.body && <RichText text={post.body} className={styles.body} />}

        {post.location && (
          <span
            className={styles.handle}
            style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}
          >
            <MapPin size={14} aria-hidden /> {post.location}
          </span>
        )}

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
          {!post.is_repost && (
            <button
              type="button"
              className={styles.action}
              aria-label="Quote"
              onClick={requireAuth(() => setQuoting(true))}
            >
              <Quote size={16} aria-hidden />
            </button>
          )}
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
          {post.visibility === "public" && (
            <ShareMenu
              compact
              variant="ghost"
              title={`${post.author.display_name} on GistLoop`}
              text={post.body.slice(0, 120)}
              path={href}
            />
          )}
        </div>
      </div>

      <ReportDialog open={reporting} onClose={() => setReporting(false)} contentType="social.post" objectId={post.id} />
      {editing && <EditDialog post={post} open={editing} onClose={() => setEditing(false)} />}
      {quoting && <QuoteDialog post={post} open={quoting} onClose={() => setQuoting(false)} />}
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
