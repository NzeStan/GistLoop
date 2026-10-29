import { EyeOff, Flag, Heart, MessageCircle, ShieldAlert, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";

import { errorMessage } from "@/api/errors";
import {
  useAddGistComment,
  useDeleteGist,
  useGist,
  useGistComments,
  useGistReaction,
  usePostGist,
} from "@/api/queries/communities";
import type { AnonymousPost } from "@/api/types";
import { LoadMore } from "@/components/LoadMore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert, Textarea } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { ReportDialog } from "@/features/feed/ReportDialog";
import styles from "@/features/feed/Post.module.css";
import { formatCount, timeAgo } from "@/lib/format";

export function GistSafetyNote() {
  return (
    <Alert tone="info">
      <strong>Anonymous, not lawless.</strong> Nobody, including other members, sees who posts gist. Hateful,
      threatening or doxxing posts can still be reported and removed, and serious abuse can be traced under our{" "}
      <Link to="/guidelines">community guidelines</Link>.
    </Alert>
  );
}

function GistComments({ post, communityId }: { post: AnonymousPost; communityId: string }) {
  const comments = useGistComments(post.id);
  const add = useAddGistComment(post.id, communityId);
  const toast = useToast();
  const [body, setBody] = useState("");
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    add.mutate(body, { onSuccess: () => setBody(""), onError: (e) => toast.error(errorMessage(e)) });
  };
  return (
    <div
      className="stack"
      style={{ "--stack-gap": "var(--space-2)", marginTop: "var(--space-2)" } as React.CSSProperties}
    >
      {comments.isPending && <Spinner />}
      {comments.data?.map((comment) => (
        <div key={comment.id} className={styles.comment}>
          <div className={styles.content}>
            <div className={styles.meta}>
              <span className={styles.name}>{comment.author.pseudonym}</span>
              {comment.author.is_op && <Badge tone="accent">OP</Badge>}
              {comment.viewer.is_author && <Badge>You</Badge>}
              <span className={styles.handle}>{timeAgo(comment.created_at)}</span>
            </div>
            <p className="pre-wrap">{comment.body}</p>
          </div>
        </div>
      ))}
      {post.comments_enabled && (
        <form className={styles.commentForm} onSubmit={onSubmit}>
          <label htmlFor={`gist-comment-${post.id}`} className="visually-hidden">
            Reply anonymously
          </label>
          <Textarea
            id={`gist-comment-${post.id}`}
            placeholder="Reply anonymously…"
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button type="submit" loading={add.isPending} disabled={!body.trim()}>
            Reply
          </Button>
        </form>
      )}
    </div>
  );
}

export function GistCard({
  post,
  communityId,
  expanded = false,
}: {
  post: AnonymousPost;
  communityId: string;
  expanded?: boolean;
}) {
  const react = useGistReaction(communityId);
  const remove = useDeleteGist(communityId);
  const toast = useToast();
  const [open, setOpen] = useState(expanded);
  const [reporting, setReporting] = useState(false);
  return (
    <article className={styles.card}>
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: "2.5rem",
          height: "2.5rem",
          borderRadius: "50%",
          background: "var(--color-bg-muted)",
          flexShrink: 0,
        }}
      >
        <EyeOff size={18} />
      </span>
      <div className={styles.content}>
        <div className={styles.meta}>
          <span className={styles.name}>Anonymous</span>
          {post.viewer.is_author && <Badge>Your gist</Badge>}
          <Link to={`/gist/p/${post.id}`} className={styles.time}>
            {timeAgo(post.created_at)}
          </Link>
          {post.status && post.status !== "published" && <Badge tone="warning">{post.status}</Badge>}
        </div>
        <p className={`${styles.body} pre-wrap`}>{post.body}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.action} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <MessageCircle size={18} aria-hidden /> {formatCount(post.counts.comments)}
            <span className="visually-hidden"> replies</span>
          </button>
          <button
            type="button"
            className={styles.action}
            aria-pressed={Boolean(post.viewer.reaction)}
            aria-label={post.viewer.reaction ? "Unlike" : "Like"}
            onClick={() => react.mutate(post, { onError: (e) => toast.error(errorMessage(e)) })}
          >
            <Heart size={18} aria-hidden /> {formatCount(post.counts.reactions)}
          </button>
          {post.viewer.is_author ? (
            <button
              type="button"
              className={styles.action}
              aria-label="Delete your gist"
              onClick={() =>
                remove.mutate(post.id, {
                  onSuccess: () => toast.success("Gist deleted"),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              <Trash2 size={18} aria-hidden />
            </button>
          ) : (
            <button type="button" className={styles.action} aria-label="Report" onClick={() => setReporting(true)}>
              <Flag size={18} aria-hidden />
            </button>
          )}
        </div>
        {open && <GistComments post={post} communityId={communityId} />}
      </div>
      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        contentType="anonymous.post"
        objectId={post.id}
      />
    </article>
  );
}

export function GistBoard({ communityId, canPost }: { communityId: string; canPost: boolean }) {
  const gist = useGist(communityId);
  const create = usePostGist(communityId);
  const toast = useToast();
  const [body, setBody] = useState("");
  const posts = gist.data?.pages.flatMap((p) => p.results) ?? [];

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    create.mutate(body, {
      onSuccess: () => {
        setBody("");
        toast.success("Your gist is live, anonymously.");
      },
    });
  };

  return (
    <div className="stack">
      <GistSafetyNote />
      {canPost && (
        <Card>
          <form className="stack" onSubmit={onSubmit}>
            <label htmlFor="gist-body" style={{ fontWeight: 700 }}>
              Share anonymously
            </label>
            <Textarea
              id="gist-body"
              placeholder="Spill the gist… nobody will know it's you."
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            {create.isError && <Alert tone="error">{errorMessage(create.error)}</Alert>}
            <div className="cluster" style={{ justifyContent: "space-between" }}>
              <span
                className="muted"
                style={{
                  fontSize: "var(--text-xs)",
                  display: "inline-flex",
                  gap: "var(--space-1)",
                  alignItems: "center",
                }}
              >
                <ShieldAlert size={14} aria-hidden /> Posting as Anonymous
              </span>
              <Button type="submit" loading={create.isPending} disabled={!body.trim()}>
                Post gist
              </Button>
            </div>
          </form>
        </Card>
      )}
      {gist.isPending ? (
        <Spinner />
      ) : gist.isError ? (
        <ErrorState error={gist.error} onRetry={() => void gist.refetch()} />
      ) : posts.length === 0 ? (
        <EmptyState icon={EyeOff} title="No gist yet">
          {canPost
            ? "Be the first to share something, anonymously."
            : "Join this community to read and share anonymous gist."}
        </EmptyState>
      ) : (
        <div className={styles.list}>
          {posts.map((post) => (
            <GistCard key={post.id} post={post} communityId={communityId} />
          ))}
          <LoadMore
            hasMore={gist.hasNextPage}
            loading={gist.isFetchingNextPage}
            onLoad={() => void gist.fetchNextPage()}
          />
        </div>
      )}
    </div>
  );
}
