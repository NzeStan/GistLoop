import { Copy, Inbox, MessageCircleQuestion, ShieldOff, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router";

import { ApiError, errorMessage } from "@/api/errors";
import {
  type InboxAction,
  useInboxAction,
  useInboxMessages,
  useMyInbox,
  usePublicAnswers,
  usePublicInbox,
  useSendAnonymousMessage,
  useUpdateInbox,
} from "@/api/queries/inbox";
import type { components } from "@/api/schema";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Alert, Checkbox, Field, Input, Textarea } from "@/components/ui/Form";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { brand } from "@/config/brand";
import styles from "@/features/content/Lists.module.css";
import { timeAgo } from "@/lib/format";

type InboxMessage = components["schemas"]["AnonymousInboxMessage"];

const MAX_LENGTH = 1000;

/** /inbox: anonymous questions people sent you, and how you answer them. */
export function InboxPage() {
  const [tab, setTab] = useState<"unanswered" | "all">("unanswered");
  const messages = useInboxMessages(tab === "unanswered");

  return (
    <>
      <Seo title="Anonymous inbox" noIndex />
      <PageHeader
        title="Anonymous inbox"
        description="Questions people send you without their names. Answer privately, or share the answer on your page."
      />
      <div className="stack">
        <InboxSettings />
        <Tabs
          label="Messages"
          value={tab}
          onChange={setTab}
          items={[
            { value: "unanswered", label: "Unanswered" },
            { value: "all", label: "All" },
          ]}
        />
        {messages.isPending ? (
          <Spinner />
        ) : messages.isError ? (
          <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />
        ) : messages.data.results.length === 0 ? (
          <EmptyState icon={Inbox} title={tab === "unanswered" ? "You're all caught up" : "No questions yet"}>
            Share your link so people can ask you anything.
          </EmptyState>
        ) : (
          <ul className={styles.list}>
            {messages.data.results.map((message) => (
              <li key={message.id}>
                <InboxMessageCard message={message} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function InboxSettings() {
  const { me } = useAuth();
  const inbox = useMyInbox();
  const update = useUpdateInbox();
  const toast = useToast();
  // Edits in progress; null shows the saved prompt.
  const [draft, setDraft] = useState<string | null>(null);

  if (inbox.isPending) return <Spinner />;
  if (inbox.isError) return <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} />;

  const link = me?.handle ? `${brand.siteUrl}/u/${me.handle}/ask` : null;
  const prompt = draft ?? inbox.data.prompt;
  const save = (body: { enabled?: boolean; prompt?: string }, done: string, after?: () => void) =>
    update.mutate(body, {
      onSuccess: () => {
        toast.success(done);
        after?.();
      },
      onError: (e) => toast.error(errorMessage(e)),
    });

  return (
    <Card>
      <div className="stack">
        <div className={styles.row}>
          <Checkbox
            label="Accept anonymous questions"
            checked={inbox.data.enabled}
            disabled={update.isPending}
            onChange={(e) => save({ enabled: e.target.checked }, e.target.checked ? "Inbox open" : "Inbox closed")}
          />
          <span className="muted">
            {inbox.data.unread_count} unread
            {inbox.data.blocked_senders > 0 && ` · ${inbox.data.blocked_senders} blocked`}
          </span>
        </div>
        {inbox.data.enabled && (
          <>
            <form
              className={styles.share}
              onSubmit={(e) => {
                e.preventDefault();
                save({ prompt }, "Prompt saved", () => setDraft(null));
              }}
            >
              <Field label="Your prompt" hint="Shown above the question box on your page." className={styles.grow}>
                <Input
                  maxLength={200}
                  placeholder="Ask me anything!"
                  value={prompt}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </Field>
              <Button
                type="submit"
                variant="secondary"
                loading={update.isPending}
                disabled={prompt === inbox.data.prompt}
              >
                Save
              </Button>
            </form>
            {link && (
              <div className={styles.share}>
                <span className="muted">Your link:</span>
                <code>{link}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  leading={<Copy size={14} />}
                  onClick={() =>
                    void navigator.clipboard
                      ?.writeText(link)
                      .then(() => toast.success("Link copied"))
                      .catch(() => toast.error("Couldn't copy. Select the link and copy it."))
                  }
                >
                  Copy
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function InboxMessageCard({ message: m }: { message: InboxMessage }) {
  const act = useInboxAction();
  const toast = useToast();
  const [answering, setAnswering] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const run = (action: InboxAction, done?: string) =>
    act.mutate(action, {
      onSuccess: () => done && toast.success(done),
      onError: (e) => toast.error(errorMessage(e)),
    });
  const answered = Boolean(m.answered_at);

  return (
    <Card className={m.read_at ? undefined : styles.unread}>
      <div className="stack">
        <div className={styles.row}>
          <span className="muted">
            Anonymous · {timeAgo(m.created_at)} {!m.read_at && <Badge tone="primary">New</Badge>}
          </span>
          {answered && (
            <Badge tone={m.answer_public ? "success" : "neutral"}>
              {m.answer_public ? "Public answer" : "Answered privately"}
            </Badge>
          )}
        </div>
        <p className={styles.quote}>{m.body}</p>
        {answered && <p className={styles.answer}>{m.answer}</p>}
        <div className="cluster">
          <Button
            size="sm"
            onClick={() => {
              setAnswering(true);
              if (!m.read_at) run({ kind: "read", id: m.id });
            }}
          >
            {answered ? "Edit answer" : "Answer"}
          </Button>
          {answered && (
            <Button
              size="sm"
              variant="ghost"
              loading={act.isPending}
              onClick={() => run({ kind: "unanswer", id: m.id }, "Answer removed")}
            >
              Remove answer
            </Button>
          )}
          {!m.read_at && !answered && (
            <Button size="sm" variant="ghost" onClick={() => run({ kind: "read", id: m.id })}>
              Mark as read
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            leading={<Trash2 size={14} />}
            onClick={() => run({ kind: "delete", id: m.id }, "Deleted")}
          >
            Delete
          </Button>
          <Button size="sm" variant="ghost" leading={<ShieldOff size={14} />} onClick={() => setConfirmBlock(true)}>
            Block sender
          </Button>
        </div>
      </div>
      <AnswerDialog message={m} open={answering} onClose={() => setAnswering(false)} />
      <Dialog open={confirmBlock} onClose={() => setConfirmBlock(false)} title="Block this sender?">
        <div className="stack">
          <p>
            They won't be able to send you anything else, and this message is removed. You still won't see who they are.
          </p>
          <div className="cluster">
            <Button
              variant="danger"
              loading={act.isPending}
              onClick={() =>
                act.mutate(
                  { kind: "block", id: m.id },
                  {
                    onSuccess: () => {
                      setConfirmBlock(false);
                      toast.success("Sender blocked");
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              Block
            </Button>
            <Button variant="ghost" onClick={() => setConfirmBlock(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}

function AnswerDialog({ message, open, onClose }: { message: InboxMessage; open: boolean; onClose: () => void }) {
  const act = useInboxAction();
  const toast = useToast();
  const [answer, setAnswer] = useState(message.answer);
  const [isPublic, setPublic] = useState(message.answered_at ? message.answer_public : true);
  const [error, setError] = useState<string>();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    act.mutate(
      { kind: "answer", id: message.id, answer, public: isPublic },
      {
        onSuccess: () => {
          toast.success(isPublic ? "Answered. It's on your page now." : "Answered privately");
          onClose();
        },
        onError: (e) => setError(e instanceof ApiError ? (e.fieldErrors.answer ?? errorMessage(e)) : errorMessage(e)),
      },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="Answer">
      <form className="stack" onSubmit={onSubmit}>
        <p className={styles.quote}>{message.body}</p>
        <Field label="Your answer" error={error}>
          <Textarea rows={4} maxLength={MAX_LENGTH * 4} value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </Field>
        <Checkbox
          label="Show the question and answer on my page"
          checked={isPublic}
          onChange={(e) => setPublic(e.target.checked)}
        />
        <div className="cluster">
          <Button type="submit" loading={act.isPending} disabled={!answer.trim()}>
            Post answer
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** /u/:handle/ask: send someone a question without your name. */
export function AskPage() {
  const { handle } = useParams();
  const { status, me } = useAuth();
  const inbox = usePublicInbox(handle);
  const answers = usePublicAnswers(inbox.data ? handle : undefined);
  const send = useSendAnonymousMessage(handle ?? "");
  const toast = useToast();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();

  if (inbox.isPending) return <PageLoader />;
  if (inbox.isError) {
    const closed = inbox.error instanceof ApiError && inbox.error.status === 404;
    return closed ? (
      <EmptyState icon={MessageCircleQuestion} title="Not taking questions">
        @{handle} isn't accepting anonymous questions right now. <Link to={`/u/${handle}`}>See their profile</Link>
      </EmptyState>
    ) : (
      <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} />
    );
  }

  const owner = inbox.data.owner;
  const isMe = me?.id === owner.id;
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    send.mutate(body.trim(), {
      onSuccess: () => {
        setBody("");
        toast.success("Sent anonymously");
      },
      onError: (e) => setError(e instanceof ApiError ? (e.fieldErrors.body ?? errorMessage(e)) : errorMessage(e)),
    });
  };

  return (
    <div className="stack container-narrow">
      <Seo title={`Ask ${owner.display_name} anything`} description={inbox.data.prompt || undefined} />
      <Card>
        <div className="stack">
          <div className="cluster">
            <Avatar name={owner.display_name} seed={owner.id} src={owner.avatar_url} size="lg" />
            <div className={styles.info}>
              <strong>{owner.display_name}</strong>
              {owner.handle && <Link to={`/u/${owner.handle}`}>@{owner.handle}</Link>}
            </div>
          </div>
          <h1 style={{ fontSize: "var(--text-xl)", margin: 0 }}>{inbox.data.prompt || "Ask me anything"}</h1>
          {isMe ? (
            <Alert>
              This is your page. Share it so people can ask you things. <Link to="/inbox">Open your inbox</Link>
            </Alert>
          ) : status === "signed-in" ? (
            <form className="stack" onSubmit={onSubmit}>
              <Field
                label="Your question"
                hint="They won't see your name. Be kind: abuse can still be reported."
                error={error}
              >
                <Textarea rows={4} maxLength={MAX_LENGTH} value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
              <div>
                <Button type="submit" loading={send.isPending} disabled={!body.trim()}>
                  Send anonymously
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <ButtonLink to={`/login?next=${encodeURIComponent(`/u/${handle}/ask`)}`}>Sign in to ask</ButtonLink>
            </div>
          )}
        </div>
      </Card>
      <h2 style={{ fontSize: "var(--text-lg)" }}>Answers ({inbox.data.answers_count})</h2>
      {answers.isPending ? (
        <Spinner />
      ) : answers.isError ? (
        <ErrorState error={answers.error} onRetry={() => void answers.refetch()} />
      ) : answers.data.results.length === 0 ? (
        <p className="muted">No public answers yet.</p>
      ) : (
        <ul className={styles.list}>
          {answers.data.results.map((a) => (
            <li key={a.id}>
              <Card>
                <div className="stack">
                  <p className={styles.quote}>{a.question}</p>
                  <p className={styles.answer}>{a.answer}</p>
                  <span className="muted">{timeAgo(a.answered_at)}</span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
