import { useRecordView } from "@/api/queries/analytics";
import { ArrowLeft, EyeOff, Heart, Pencil, Reply, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { errorMessage } from "@/api/errors";
import { can, usePermissions } from "@/api/queries/institutions";
import { useCommentReaction, useModerateContent } from "@/api/queries/relationships";
import { useAddComment, useComments, useDeleteComment, useEditComment, usePost } from "@/api/queries/social";
import type { Comment } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { RichText } from "@/components/RichText";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Form";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { formatCount, timeAgo } from "@/lib/format";

import { PostCard } from "./PostCard";
import styles from "./Post.module.css";

function CommentItem({
  comment,
  postId,
  canReply,
  moderator,
}: {
  comment: Comment;
  postId: string;
  canReply: boolean;
  moderator: boolean;
}) {
  const { me, status } = useAuth();
  const remove = useDeleteComment(postId);
  const edit = useEditComment(postId);
  const like = useCommentReaction(postId);
  const moderate = useModerateContent();
  const add = useAddComment(postId);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [showReplies, setShowReplies] = useState(false);
  const replies = useComments(showReplies ? postId : undefined, comment.id);
  const mine = me?.id === comment.author.id;
  return (
    <div className={styles.comment}>
      <Avatar name={comment.author.display_name} seed={comment.author.id} src={comment.author.avatar_url} size="sm" />
      <div className={styles.content}>
        <div className={styles.meta}>
          {comment.author.handle ? (
            <Link to={`/u/${comment.author.handle}`} className={styles.name}>
              {comment.author.display_name}
            </Link>
          ) : (
            <span className={styles.name}>{comment.author.display_name}</span>
          )}
          <span className={styles.handle}>{timeAgo(comment.created_at)}</span>
          {comment.edited_at && <span className={styles.handle}>(edited)</span>}
        </div>
        {editing ? (
          <form
            className={styles.commentForm}
            onSubmit={(e) => {
              e.preventDefault();
              edit.mutate(
                { id: comment.id, body: draft },
                { onSuccess: () => setEditing(false), onError: (err) => toast.error(errorMessage(err)) },
              );
            }}
          >
            <label htmlFor={`edit-${comment.id}`} className="visually-hidden">
              Edit comment
            </label>
            <Textarea
              id={`edit-${comment.id}`}
              value={draft}
              maxLength={2000}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button type="submit" size="sm" loading={edit.isPending} disabled={!draft.trim()}>
              Save
            </Button>
          </form>
        ) : (
          <RichText text={comment.body} />
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            aria-pressed={Boolean(comment.viewer_reaction)}
            aria-label={comment.viewer_reaction ? "Unlike comment" : "Like comment"}
            disabled={status !== "signed-in"}
            onClick={() =>
              like.mutate(
                { commentId: comment.id, liked: Boolean(comment.viewer_reaction) },
                { onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            <Heart size={14} aria-hidden /> {formatCount(comment.reaction_count)}
          </button>
          {canReply && status === "signed-in" && !comment.parent && (
            <button type="button" className={styles.action} onClick={() => setReplying((v) => !v)}>
              <Reply size={14} aria-hidden /> Reply
            </button>
          )}
          {comment.reply_count > 0 && !comment.parent && (
            <button
              type="button"
              className={styles.action}
              aria-expanded={showReplies}
              onClick={() => setShowReplies((v) => !v)}
            >
              {showReplies
                ? "Hide replies"
                : `${comment.reply_count} ${comment.reply_count === 1 ? "reply" : "replies"}`}
            </button>
          )}
          {mine && (
            <>
              <button
                type="button"
                className={styles.action}
                aria-label="Edit comment"
                onClick={() => setEditing((v) => !v)}
              >
                <Pencil size={14} aria-hidden />
              </button>
              <button
                type="button"
                className={styles.action}
                aria-label="Delete comment"
                onClick={() => remove.mutate(comment.id, { onError: (e) => toast.error(errorMessage(e)) })}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </>
          )}
          {moderator && !mine && (
            <button
              type="button"
              className={styles.action}
              aria-label="Hide comment (moderator)"
              onClick={() =>
                moderate.mutate(
                  { kind: "comments", id: comment.id, action: "hide" },
                  { onSuccess: () => toast.success("Comment hidden"), onError: (e) => toast.error(errorMessage(e)) },
                )
              }
            >
              <EyeOff size={14} aria-hidden />
            </button>
          )}
        </div>
        {replying && (
          <form
            className={styles.commentForm}
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate(
                { body: reply, parent: comment.id },
                {
                  onSuccess: () => (setReply(""), setReplying(false), setShowReplies(true)),
                  onError: (err) => toast.error(errorMessage(err)),
                },
              );
            }}
          >
            <label htmlFor={`reply-${comment.id}`} className="visually-hidden">
              Reply to {comment.author.display_name}
            </label>
            <Textarea
              id={`reply-${comment.id}`}
              value={reply}
              maxLength={2000}
              onChange={(e) => setReply(e.target.value)}
            />
            <Button type="submit" size="sm" loading={add.isPending} disabled={!reply.trim()}>
              Reply
            </Button>
          </form>
        )}
        {showReplies &&
          replies.data?.map((r) => (
            <CommentItem key={r.id} comment={r} postId={postId} canReply={false} moderator={moderator} />
          ))}
      </div>
    </div>
  );
}

function Comments({ postId, enabled }: { postId: string; enabled: boolean }) {
  const { status, me } = useAuth();
  const comments = useComments(postId);
  const add = useAddComment(postId);
  const perms = usePermissions("platform", "", status === "signed-in");
  const toast = useToast();
  const [body, setBody] = useState("");
  const moderator = can(perms.data, "social.content.moderate");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    add.mutate(body, { onSuccess: () => setBody(""), onError: (e) => toast.error(errorMessage(e)) });
  };

  return (
    <Card>
      <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>Comments</h2>
      {enabled && status === "signed-in" && (
        <form className={styles.commentForm} onSubmit={onSubmit} style={{ marginBottom: "var(--space-3)" }}>
          <Avatar name={me?.display_name} seed={me?.id} src={me?.avatar_url} size="sm" />
          <label htmlFor="comment" className="visually-hidden">
            Add a comment
          </label>
          <Textarea
            id="comment"
            placeholder="Add to the conversation…"
            maxLength={2000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <Button type="submit" loading={add.isPending} disabled={!body.trim()}>
            Reply
          </Button>
        </form>
      )}
      {enabled && status === "signed-out" && (
        <p className="muted" style={{ marginBottom: "var(--space-3)" }}>
          <Link to={`/login?next=/posts/${postId}`}>Sign in</Link> to join the conversation.
        </p>
      )}
      {!enabled && <p className="muted">Comments are turned off for this post.</p>}
      {comments.isPending && <p className="muted">Loading comments…</p>}
      {comments.isError && <ErrorState error={comments.error} onRetry={() => void comments.refetch()} />}
      {comments.data?.length === 0 && enabled && <p className="muted">No comments yet. Start the conversation!</p>}
      {comments.data?.map((comment) => (
        <CommentItem key={comment.id} comment={comment} postId={postId} canReply={enabled} moderator={moderator} />
      ))}
    </Card>
  );
}

export default function PostPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const post = usePost(postId);
  useRecordView("social.post", post.data?.id);

  if (post.isPending) return <PageLoader />;
  if (post.isError) {
    return (
      <div className="stack">
        <ErrorState error={post.error} onRetry={() => void post.refetch()} />
        <ButtonLink to="/feed" variant="secondary">
          Back to the feed
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="stack">
      <Seo
        title={`${post.data.author.display_name}: “${post.data.body.slice(0, 60)}”`}
        description={post.data.body.slice(0, 160)}
      />
      <div>
        <Button variant="ghost" size="sm" leading={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>
      <PostCard post={post.data} linkToDetail={false} />
      <Comments postId={post.data.id} enabled={post.data.comments_enabled} />
    </div>
  );
}
