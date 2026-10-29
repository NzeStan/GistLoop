import { Archive, BellOff, LogOut, MessagesSquare, PenSquare, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import { ApiError, errorMessage } from "@/api/errors";
import { useProfile } from "@/api/queries/account";
import { usePeopleSearch } from "@/api/queries/discovery";
import {
  type Conversation,
  type Folder,
  type Message,
  useConversation,
  useConversationAction,
  useConversations,
  useMarkConversationRead,
  useMessageAction,
  useMessages,
  useMessagingSettings,
  useMessagingUnread,
  useSendMessage,
  useStartConversation,
  useUpdateMessagingSettings,
} from "@/api/queries/messaging";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert, Checkbox, Field, Input, Textarea } from "@/components/ui/Form";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";

import styles from "./Messages.module.css";

const MAX_LENGTH = 4000;

type Person = { id: string; handle?: string | null; display_name: string; avatar_url?: string | null };

/** "Tunde Bakare", or a group's title, or "Tunde, Amaka and 3 others". */
function conversationName(c: Conversation, myId: string | undefined): string {
  if (c.title) return c.title;
  const others = c.participants.filter((p) => p.id !== myId);
  if (others.length === 0) return "Just you";
  if (others.length <= 2) return others.map((p) => p.display_name).join(" and ");
  return `${others[0]!.display_name}, ${others[1]!.display_name} and ${others.length - 2} others`;
}

function preview(m: Message | null | undefined, myId: string | undefined): string {
  if (!m) return "No messages yet";
  if (m.status !== "visible") return "Message removed";
  return `${m.sender?.id === myId ? "You: " : ""}${m.body}`;
}

/** /messages: conversations, message requests and the archive. */
export function MessagesPage() {
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const folder = (
    ["requests", "archived"].includes(params.get("folder") ?? "") ? params.get("folder") : "inbox"
  ) as Folder;
  const conversations = useConversations(folder);
  const unread = useMessagingUnread(true);
  const requests = unread.data?.requests ?? 0;

  return (
    <>
      <Seo title="Messages" noIndex />
      <PageHeader
        title="Messages"
        description="Private conversations. People you don't follow land in Requests first."
        actions={
          <ButtonLink to="/messages/new" leading={<PenSquare size={16} />}>
            New message
          </ButtonLink>
        }
      />
      <div className="stack">
        <Tabs
          label="Folders"
          value={folder}
          onChange={(next) => setParams(next === "inbox" ? {} : { folder: next })}
          items={[
            { value: "inbox", label: "Chats" },
            { value: "requests", label: requests ? `Requests (${requests})` : "Requests" },
            { value: "archived", label: "Archived" },
          ]}
        />
        {conversations.isPending ? (
          <Spinner />
        ) : conversations.isError ? (
          <ErrorState error={conversations.error} onRetry={() => void conversations.refetch()} />
        ) : conversations.data.results.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title={
              folder === "requests"
                ? "No message requests"
                : folder === "archived"
                  ? "Nothing archived"
                  : "No messages yet"
            }
          >
            {folder === "inbox" && <Link to="/messages/new">Start a conversation</Link>}
          </EmptyState>
        ) : (
          <Card padded={false}>
            <ul className={styles.conversations}>
              {conversations.data.results.map((c) => {
                const others = c.participants.filter((p) => p.id !== me?.id);
                const face = others[0];
                return (
                  <li key={c.id}>
                    <Link to={`/messages/${c.id}`} className={styles.conversation}>
                      <Avatar name={face?.display_name ?? c.title} seed={face?.id ?? c.id} src={face?.avatar_url} />
                      <span className={styles.conversationText}>
                        <span className={c.unread_count ? styles.unreadName : undefined}>
                          {conversationName(c, me?.id)} {c.muted && <BellOff size={12} aria-label="Muted" />}
                        </span>
                        <span>{preview(c.last_message, me?.id)}</span>
                      </span>
                      <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                        {c.last_message_at && timeAgo(c.last_message_at)}
                      </span>
                      {c.unread_count > 0 && (
                        <span className={styles.count} aria-label={`${c.unread_count} unread`}>
                          {c.unread_count > 99 ? "99+" : c.unread_count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
        <MessagingSettingsCard />
      </div>
    </>
  );
}

function MessagingSettingsCard() {
  const settings = useMessagingSettings();
  const update = useUpdateMessagingSettings();
  const toast = useToast();
  if (!settings.data) return null;
  return (
    <Card>
      <Checkbox
        label="Allow message requests from people I don't follow"
        checked={settings.data.allow_requests}
        disabled={update.isPending}
        onChange={(e) =>
          update.mutate(
            { allow_requests: e.target.checked },
            { onSuccess: () => toast.success("Saved"), onError: (err) => toast.error(errorMessage(err)) },
          )
        }
      />
    </Card>
  );
}

/** /messages/new?to=handle: pick people and send the first message. */
export function NewMessagePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { me } = useAuth();
  const preset = useProfile(params.get("to") ?? undefined);
  const [picked, setPicked] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const people = usePeopleSearch(useDebounced(q));
  const start = useStartConversation();

  // The person from ?to= is picked until removed.
  const [presetRemoved, setPresetRemoved] = useState(false);
  const presetPerson = preset.data && preset.data.id !== me?.id && !presetRemoved ? preset.data : null;
  const recipients: Person[] =
    presetPerson && !picked.some((x) => x.id === presetPerson.id) ? [presetPerson, ...picked] : picked;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    start.mutate(
      {
        participant_ids: recipients.map((p) => p.id),
        body: body.trim(),
        ...(recipients.length > 1 && title ? { title } : {}),
      },
      {
        onSuccess: (conversation) => navigate(`/messages/${conversation.id}`, { replace: true }),
        onError: (e) => {
          const fields = e instanceof ApiError ? e.fieldErrors : {};
          setError(fields.participant_ids ?? fields.body ?? errorMessage(e));
        },
      },
    );
  };

  const results = (people.data ?? []).filter((p) => p.id !== me?.id && !recipients.some((x) => x.id === p.id));

  return (
    <>
      <Seo title="New message" noIndex />
      <PageHeader title="New message" />
      <Card>
        <form className="stack" onSubmit={onSubmit} style={{ maxWidth: "40rem" }}>
          {recipients.length > 0 && (
            <div className={styles.picked}>
              {recipients.map((p) => (
                <Badge key={p.id} tone="primary">
                  {p.display_name}
                  <button
                    type="button"
                    aria-label={`Remove ${p.display_name}`}
                    onClick={() => {
                      if (p.id === presetPerson?.id) setPresetRemoved(true);
                      setPicked((current) => current.filter((x) => x.id !== p.id));
                    }}
                    style={{ border: 0, background: "none", color: "inherit", cursor: "pointer", padding: 0 }}
                  >
                    <X size={12} aria-hidden />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <Field label="To" hint="Search by name or @handle (at least 3 letters).">
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          </Field>
          {q.trim().length >= 3 && (
            <ul className={styles.results} aria-label="People">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={styles.result}
                    onClick={() => {
                      setPicked((current) => [...current, p]);
                      setQ("");
                    }}
                  >
                    <Avatar name={p.display_name} seed={p.id} src={(p as Person).avatar_url} size="sm" />
                    <span>
                      {p.display_name} {p.handle && <span className="muted">@{p.handle}</span>}
                    </span>
                  </button>
                </li>
              ))}
              {people.isSuccess && results.length === 0 && <li className="muted">No one found.</li>}
            </ul>
          )}
          {recipients.length > 1 && (
            <Field label="Group name" optional>
              <Input maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
          )}
          <Field label="Message" error={error}>
            <Textarea rows={4} maxLength={MAX_LENGTH} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <div>
            <Button type="submit" loading={start.isPending} disabled={recipients.length === 0 || !body.trim()}>
              Send
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

/** /messages/:conversationId: one conversation. */
export function ConversationPage() {
  const { conversationId } = useParams();
  const { me } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const conversation = useConversation(conversationId);
  const messages = useMessages(conversationId);
  const act = useConversationAction(conversationId ?? "");
  const markRead = useMarkConversationRead();
  const unread = conversation.data?.unread_count ?? 0;
  const isRequest = conversation.data?.state === "request";

  // Opening a conversation reads it (not while it's still an unanswered request).
  useEffect(() => {
    if (conversationId && unread > 0 && !isRequest) markRead.mutate(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark once per change in unread count
  }, [conversationId, unread, isRequest]);

  // Pages arrive newest first; show oldest at the top.
  const ordered = useMemo(
    () => (messages.data?.pages.flatMap((p) => p.results) ?? []).slice().reverse(),
    [messages.data],
  );

  if (conversation.isPending) return <PageLoader />;
  if (conversation.isError)
    return <ErrorState error={conversation.error} onRetry={() => void conversation.refetch()} />;

  const c = conversation.data;
  const name = conversationName(c, me?.id);
  const run = (action: Parameters<typeof act.mutate>[0], done: string, after?: () => void) =>
    act.mutate(action, {
      onSuccess: () => {
        toast.success(done);
        after?.();
      },
      onError: (e) => toast.error(errorMessage(e)),
    });

  return (
    <div className={styles.thread}>
      <Seo title={name} noIndex />
      <div className={styles.threadHead}>
        <div>
          <h1 style={{ fontSize: "var(--text-lg)", margin: 0 }}>{name}</h1>
          {c.kind === "group" && (
            <span className="muted" style={{ fontSize: "var(--text-sm)" }}>
              {c.participants.length} people
            </span>
          )}
        </div>
        <div className="cluster">
          <Button
            size="sm"
            variant="ghost"
            leading={<BellOff size={14} />}
            onClick={() => run({ kind: "update", body: { muted: !c.muted } }, c.muted ? "Unmuted" : "Muted")}
          >
            {c.muted ? "Unmute" : "Mute"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leading={<Archive size={14} />}
            onClick={() =>
              run({ kind: "update", body: { archived: !c.archived } }, c.archived ? "Moved to chats" : "Archived")
            }
          >
            {c.archived ? "Unarchive" : "Archive"}
          </Button>
          {c.kind === "group" && (
            <Button
              size="sm"
              variant="ghost"
              leading={<LogOut size={14} />}
              onClick={() => run({ kind: "leave" }, "You left the group", () => navigate("/messages"))}
            >
              Leave
            </Button>
          )}
        </div>
      </div>

      {isRequest && (
        <Alert>
          <div className="stack">
            <span>
              This is a message request. They won't know you've seen it unless you accept, and declining stops further
              messages.
            </span>
            <div className="cluster">
              <Button size="sm" loading={act.isPending} onClick={() => run({ kind: "accept" }, "Accepted")}>
                Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => run({ kind: "decline" }, "Declined", () => navigate("/messages?folder=requests"))}
              >
                Decline
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {messages.hasNextPage && (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "var(--space-3)" }}>
          <Button
            size="sm"
            variant="secondary"
            loading={messages.isFetchingNextPage}
            onClick={() => void messages.fetchNextPage()}
          >
            Load earlier messages
          </Button>
        </div>
      )}
      {messages.isPending ? (
        <Spinner />
      ) : messages.isError ? (
        <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />
      ) : (
        <ol className={styles.messages} aria-label="Messages" aria-live="polite">
          {ordered.map((m) => (
            <MessageBubble key={m.id} message={m} conversationId={c.id} showSender={c.kind === "group"} />
          ))}
        </ol>
      )}
      {c.state !== "declined" && c.state !== "left" && <Composer conversationId={c.id} />}
    </div>
  );
}

function MessageBubble({
  message: m,
  conversationId,
  showSender,
}: {
  message: Message;
  conversationId: string;
  showSender: boolean;
}) {
  const act = useMessageAction(conversationId);
  const toast = useToast();
  const visible = m.status === "visible";
  return (
    <li className={`${styles.message} ${m.is_mine ? styles.mine : ""}`}>
      {showSender && !m.is_mine && m.sender && <span className={styles.meta}>{m.sender.display_name}</span>}
      <div className={`${styles.bubble} ${visible ? "" : styles.removed}`}>
        {visible ? m.body : m.status === "hidden" ? "Removed by the moderators" : "Message deleted"}
      </div>
      <span className={styles.meta}>
        <time dateTime={m.created_at} title={formatDateTime(m.created_at)}>
          {timeAgo(m.created_at)}
        </time>
        {m.edited_at && <span>edited</span>}
        {m.is_mine && visible && (
          <button
            type="button"
            disabled={act.isPending}
            onClick={() => act.mutate({ messageId: m.id }, { onError: (e) => toast.error(errorMessage(e)) })}
          >
            Delete
          </button>
        )}
      </span>
    </li>
  );
}

function Composer({ conversationId }: { conversationId: string }) {
  const send = useSendMessage(conversationId);
  const toast = useToast();
  const [body, setBody] = useState("");

  const submit = () => {
    const text = body.trim();
    if (!text || send.isPending) return;
    send.mutate({ body: text }, { onSuccess: () => setBody(""), onError: (e) => toast.error(errorMessage(e)) });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor="message-body" className="visually-hidden">
        Message
      </label>
      <Textarea
        id="message-body"
        rows={2}
        maxLength={MAX_LENGTH}
        placeholder="Write a message… (Enter sends, Shift+Enter adds a line)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <Button type="submit" loading={send.isPending} disabled={!body.trim()}>
        Send
      </Button>
    </form>
  );
}
