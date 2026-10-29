import { ArrowLeft, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { errorMessage } from "@/api/errors";
import { useAddComment, useComments, useDeleteComment, usePost } from "@/api/queries/social";
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
import { timeAgo } from "@/lib/format";

import { PostCard } from "./PostCard";
import styles from "./Post.module.css";

function Comments({ postId, enabled }: { postId: string; enabled: boolean }) {
  const { status, me } = useAuth();
  const comments = useComments(postId);
  const add = useAddComment(postId);
  const remove = useDeleteComment(postId);
  const toast = useToast();
  const [body, setBody] = useState("");

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
        <div key={comment.id} className={styles.comment}>
          <Avatar
            name={comment.author.display_name}
            seed={comment.author.id}
            src={comment.author.avatar_url}
            size="sm"
          />
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
              {me?.id === comment.author.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon
                  className={styles.more}
                  aria-label="Delete comment"
                  onClick={() => remove.mutate(comment.id, { onError: (e) => toast.error(errorMessage(e)) })}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
            <RichText text={comment.body} />
          </div>
        </div>
      ))}
    </Card>
  );
}

export default function PostPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const post = usePost(postId);

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
