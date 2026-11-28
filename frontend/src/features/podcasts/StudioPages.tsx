import { ExternalLink, Mic, Plus, Rss, Trash2, Upload, Video as Youtube } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { errorMessage } from "@/api/errors";
import {
  type EpisodeWrite,
  type ShowWrite,
  clipStreamUrl,
  uploadMedia,
  useAddGuest,
  useAddPodcastMember,
  useClips,
  useConnectChannel,
  useCreateClip,
  useCreateEpisode,
  useCreatePodcast,
  useCreateSeason,
  useDeleteClip,
  useDeleteEpisode,
  useDisconnectChannel,
  useGenerateTranscript,
  useMediaAsset,
  useMyPodcasts,
  usePodcastAnalytics,
  usePodcastMembers,
  usePodcastStatus,
  usePublishEpisode,
  useRemoveGuest,
  useRemovePodcastMember,
  useRemoveYouTubeVideo,
  useRespondToGuestSpot,
  useSaveTranscript,
  useSeasons,
  useSetYouTubeVideo,
  useStudioEpisode,
  useStudioEpisodes,
  useStudioShow,
  useSyncChannel,
  useTranscript,
  useTransferPodcast,
  useUnpublishEpisode,
  useUpdateEpisode,
  useUpdatePodcast,
  useYouTubeChannel,
  useYouTubeVideos,
} from "@/api/queries/studio";
import type { Episode, Podcast } from "@/api/types";
import { ActionButton, DataTable, Section, StatusBadge } from "@/components/Manage";
import m from "@/components/Manage.module.css";
import { PageHeader } from "@/components/PageHeader";
import { PersonPicker } from "@/components/PersonPicker";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { AnchorButton, Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilePicker } from "@/components/ui/FilePicker";
import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatDateTime, formatDuration, humanize } from "@/lib/format";

const CATEGORIES = [
  "Education",
  "Campus life",
  "Careers",
  "Business",
  "Technology",
  "Comedy",
  "Culture",
  "Faith",
  "Health",
  "Music",
  "News",
  "Sports",
  "Society",
  "Arts",
];
const AUDIO_TYPES = "audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/flac";
const VIDEO_TYPES = "video/mp4,video/quicktime,video/webm";

// --------------------------------------------------------------------- your shows
function ShowForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  initial?: Partial<Podcast>;
  submitLabel: string;
  busy: boolean;
  onSubmit: (body: ShowWrite) => void;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    author_name: initial?.author_name ?? "",
    category: initial?.category ?? "Campus life",
    language: initial?.language ?? "en",
    website: initial?.website ?? "",
    explicit: initial?.explicit ?? false,
    visibility: (initial?.visibility ?? "public") as ShowWrite["visibility"],
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  return (
    <form
      className={m.form}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...form, website: form.website || "" });
      }}
    >
      <Field label="Show name">
        <Input value={form.title} maxLength={200} onChange={set("title")} required />
      </Field>
      <Field label="What it's about">
        <Textarea rows={4} value={form.description} onChange={set("description")} />
      </Field>
      <div className={m.formRow}>
        <Field label="Host or author name" optional>
          <Input value={form.author_name} onChange={set("author_name")} />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={set("category")}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Language">
          <Select value={form.language} onChange={set("language")}>
            <option value="en">English</option>
            <option value="pcm">Pidgin</option>
            <option value="yo">Yorùbá</option>
            <option value="ig">Igbo</option>
            <option value="ha">Hausa</option>
          </Select>
        </Field>
        <Field label="Who can find it">
          <Select value={form.visibility} onChange={set("visibility")}>
            <option value="public">Everyone</option>
            <option value="unlisted">Only people with the link</option>
          </Select>
        </Field>
        <Field label="Website" optional>
          <Input type="url" value={form.website} onChange={set("website")} />
        </Field>
      </div>
      <Checkbox
        label="Explicit content"
        checked={form.explicit}
        onChange={(e) => setForm((f) => ({ ...f, explicit: e.target.checked }))}
      />
      <div>
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** /studio: your podcasts. */
export function StudioHome() {
  const mine = useMyPodcasts();
  const create = useCreatePodcast();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  return (
    <div className="stack">
      <Seo title="Podcast studio" noIndex />
      <PageHeader
        eyebrow={
          <>
            <Mic size={14} aria-hidden /> Podcast studio
          </>
        }
        title="Your podcasts"
        description="Upload audio or video, or link YouTube videos so people watch here while the views count on YouTube."
        actions={
          <Button leading={<Plus size={16} />} onClick={() => setStarting(true)}>
            Start a podcast
          </Button>
        }
      />
      {starting && (
        <Section title="Start a podcast">
          <ShowForm
            submitLabel="Create show"
            busy={create.isPending}
            onSubmit={(body) => create.mutate(body, { onSuccess: (show) => navigate(`/studio/${show.id}`) })}
          />
          {create.isError && <Alert tone="error">{errorMessage(create.error)}</Alert>}
        </Section>
      )}
      {mine.isPending ? (
        <Spinner />
      ) : mine.isError ? (
        <ErrorState error={mine.error} />
      ) : mine.data.length === 0 ? (
        !starting && (
          <EmptyState
            icon={Mic}
            title="No podcasts yet"
            action={<Button onClick={() => setStarting(true)}>Start one</Button>}
          >
            Make a show for your department, fellowship, sports team or just your gist.
          </EmptyState>
        )
      ) : (
        <Card>
          <ul className={m.list}>
            {mine.data.map((p) => (
              <li key={p.id} className={m.item}>
                <div className={m.itemMain}>
                  <Link to={`/studio/${p.id}`}>
                    <strong>{p.title}</strong>
                  </Link>
                  <span className="cluster" style={{ "--cluster-gap": "var(--space-2)" } as React.CSSProperties}>
                    <StatusBadge status={p.status} />
                    <span className={m.small}>{p.subscriber_count} subscribers</span>
                  </span>
                </div>
                <ButtonLink to={`/studio/${p.id}`} size="sm" variant="secondary">
                  Open
                </ButtonLink>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// --------------------------------------------------------------------- a show
function EpisodesTab({ show }: { show: Podcast }) {
  const episodes = useStudioEpisodes(show.id);
  const videos = useYouTubeVideos(show.id);
  const create = useCreateEpisode(show.id);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  return (
    <Section title="Episodes">
      <form
        className="cluster"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { title: title.trim() },
            { onSuccess: (ep) => navigate(`/studio/${show.id}/episodes/${ep.id}`) },
          );
        }}
      >
        <label htmlFor="new-episode" className="visually-hidden">
          New episode title
        </label>
        <Input
          id="new-episode"
          placeholder="New episode title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" loading={create.isPending} disabled={!title.trim()} leading={<Plus size={16} />}>
          New episode
        </Button>
      </form>
      {create.isError && <Alert tone="error">{errorMessage(create.error)}</Alert>}
      {episodes.isPending ? (
        <Spinner />
      ) : (episodes.data ?? []).length === 0 ? (
        <p className="muted">No episodes yet.</p>
      ) : (
        <DataTable
          caption="Episodes"
          rows={episodes.data!}
          rowKey={(e) => e.id}
          columns={[
            {
              header: "Episode",
              cell: (e) => (
                <Link to={`/studio/${show.id}/episodes/${e.id}`}>
                  {e.number ? `${e.number}. ` : ""}
                  {e.title}
                </Link>
              ),
            },
            {
              header: "Media",
              cell: (e) => (
                <span className="cluster" style={{ "--cluster-gap": "var(--space-1)" } as React.CSSProperties}>
                  {e.has_audio && <Badge>Audio</Badge>}
                  {e.has_video && <Badge>Video</Badge>}
                  {videos.data?.has(e.id) && <Badge tone="danger">YouTube</Badge>}
                  {!e.has_audio && !e.has_video && !videos.data?.has(e.id) && <span className={m.small}>None yet</span>}
                </span>
              ),
            },
            { header: "Status", cell: (e) => <StatusBadge status={e.status} /> },
            {
              header: "Date",
              cell: (e) =>
                e.published_at
                  ? formatDate(e.published_at)
                  : e.publish_at
                    ? `Scheduled ${formatDateTime(e.publish_at)}`
                    : "–",
            },
          ]}
        />
      )}
    </Section>
  );
}

function DetailsTab({ show }: { show: Podcast }) {
  const update = useUpdatePodcast(show.id);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const onCover = async (file: File) => {
    setUploading(true);
    try {
      const asset = await uploadMedia(file, "image");
      await update.mutateAsync({ cover_media_id: asset.id });
      toast.success("Cover updated");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };
  return (
    <>
      <Section title="Cover art" description="A square image, at least 1400 × 1400 pixels, works everywhere.">
        <FilePicker maxMb={10} loading={uploading} onPick={(files) => files[0] && void onCover(files[0])}>
          {show.has_cover ? "Change cover" : "Upload cover"}
        </FilePicker>
      </Section>
      <Section title="Show details">
        <ShowForm
          initial={show}
          submitLabel="Save"
          busy={update.isPending}
          onSubmit={(body) =>
            update.mutate(body, {
              onSuccess: () => toast.success("Saved"),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        />
      </Section>
    </>
  );
}

function SeasonsTab({ show }: { show: Podcast }) {
  const seasons = useSeasons(show.id);
  const create = useCreateSeason(show.id);
  const toast = useToast();
  const [title, setTitle] = useState("");
  const next = (seasons.data?.reduce((max, s) => Math.max(max, s.number), 0) ?? 0) + 1;
  return (
    <Section title="Seasons" description="Group episodes into seasons (optional).">
      <form
        className="cluster"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { number: next, title: title.trim() },
            {
              onSuccess: () => (setTitle(""), toast.success("Season added")),
              onError: (err) => toast.error(errorMessage(err)),
            },
          );
        }}
      >
        <Field label={`Season ${next} title`} optional>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Button type="submit" loading={create.isPending}>
          Add season {next}
        </Button>
      </form>
      <ul className={m.list}>
        {seasons.data?.map((s) => (
          <li key={s.id} className={m.item}>
            <strong>
              Season {s.number}
              {s.title && `: ${s.title}`}
            </strong>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TeamTab({ show }: { show: Podcast }) {
  const members = usePodcastMembers(show.id);
  const add = useAddPodcastMember(show.id);
  const remove = useRemovePodcastMember(show.id);
  const transfer = useTransferPodcast(show.id);
  const toast = useToast();
  const [role, setRole] = useState<"host" | "producer">("host");
  return (
    <Section title="Team" description="Hosts and producers can edit the show and its episodes.">
      <div className={m.formRow}>
        <PersonPicker
          label="Add someone"
          onPick={(p) =>
            add.mutate(
              { user_id: p.id, role },
              {
                onSuccess: () => toast.success(`${p.display_name} added`),
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
        />
        <Field label="As">
          <Select value={role} onChange={(e) => setRole(e.target.value as "host" | "producer")}>
            <option value="host">Host</option>
            <option value="producer">Producer</option>
          </Select>
        </Field>
      </div>
      {members.isPending ? (
        <Spinner />
      ) : (
        <ul className={m.list}>
          {members.data
            ?.filter((mem) => mem.user)
            .map(({ user, ...mem }) => ({ ...mem, user: user! }))
            .map((mem) => (
              <li key={mem.user.id} className={m.item}>
                <span className="cluster">
                  <Avatar name={mem.user.display_name} seed={mem.user.id} src={mem.user.avatar_url} size="sm" />
                  <span className={m.itemMain}>
                    <strong>{mem.user.display_name}</strong>
                    <span className={m.small}>{humanize(mem.role)}</span>
                  </span>
                </span>
                {mem.role !== "owner" && (
                  <div className={m.rowActions}>
                    <ActionButton
                      confirm={`Make ${mem.user.display_name} the owner? You'll become a host.`}
                      run={() => transfer.mutateAsync(mem.user.id)}
                      success="Ownership transferred"
                    >
                      Make owner
                    </ActionButton>
                    <ActionButton variant="danger" run={() => remove.mutateAsync(mem.user.id)} success="Removed">
                      Remove
                    </ActionButton>
                  </div>
                )}
              </li>
            ))}
        </ul>
      )}
    </Section>
  );
}

function YouTubeTab({ show }: { show: Podcast }) {
  const channel = useYouTubeChannel(show.id);
  const connect = useConnectChannel(show.id);
  const disconnect = useDisconnectChannel(show.id);
  const sync = useSyncChannel(show.id);
  const toast = useToast();
  const [value, setValue] = useState("");
  return (
    <Section
      title={
        <>
          <Youtube size={18} aria-hidden /> YouTube channel
        </>
      }
      description="Connect your channel and every new upload becomes a draft episode here (checked hourly). Review it, then publish. People watch on GistLoop; the views count on YouTube."
    >
      {channel.isPending ? (
        <Spinner />
      ) : channel.data ? (
        <div className="stack">
          <p>
            Connected:{" "}
            <a href={channel.data.channel_url} target="_blank" rel="noopener noreferrer">
              {channel.data.channel_id} <ExternalLink size={12} aria-hidden />
            </a>
          </p>
          <p className={m.small}>
            {channel.data.last_synced_at
              ? `Last checked ${formatDateTime(channel.data.last_synced_at)}`
              : "Not checked yet"}
            {` · importing uploads after ${formatDateTime(channel.data.import_since)}`}
          </p>
          {channel.data.last_error && <Alert tone="warning">Last check: {channel.data.last_error}</Alert>}
          <div className="cluster">
            <ActionButton
              variant="primary"
              run={async () => {
                const r = await sync.mutateAsync();
                toast.success(
                  r.imported
                    ? `Imported ${r.imported} new video${r.imported === 1 ? "" : "s"} as drafts`
                    : "No new videos",
                );
              }}
            >
              Check for new videos now
            </ActionButton>
            <ActionButton
              variant="danger"
              confirm="Disconnect the channel? Existing episodes stay."
              run={() => disconnect.mutateAsync()}
              success="Disconnected"
            >
              Disconnect
            </ActionButton>
          </div>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            connect.mutate(
              { channel: value.trim(), auto_import: true },
              { onSuccess: () => toast.success("Channel connected"), onError: (err) => toast.error(errorMessage(err)) },
            );
          }}
        >
          <Field
            label="Channel ID or channel link"
            hint="Starts with UC. In YouTube Studio: Settings → Channel → Advanced settings. Or youtube.com/channel/UC…"
          >
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <div>
            <Button type="submit" loading={connect.isPending} disabled={!value.trim()}>
              Connect
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

function StatsTab({ show }: { show: Podcast }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const stats = usePodcastAnalytics(show.id, from, to);
  return (
    <Section title="Listens">
      <div className="cluster">
        <Field label="From" optional>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To" optional>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {stats.isPending ? (
        <Spinner />
      ) : stats.isError ? (
        <ErrorState error={stats.error} />
      ) : (
        <>
          <div className={m.statGrid}>
            <div className={m.stat}>
              <span className={m.statValue}>{stats.data.subscribers}</span>
              <span className={m.small}>Subscribers</span>
            </div>
            <div className={m.stat}>
              <span className={m.statValue}>{stats.data.episodes.reduce((n, e) => n + e.plays, 0)}</span>
              <span className={m.small}>Plays</span>
            </div>
            <div className={m.stat}>
              <span className={m.statValue}>{stats.data.episodes.reduce((n, e) => n + e.completions, 0)}</span>
              <span className={m.small}>Listened to the end</span>
            </div>
          </div>
          <p className={m.small}>
            {formatDate(stats.data.from)} – {formatDate(stats.data.to)}. YouTube views are counted on YouTube.
          </p>
          <DataTable
            caption="Plays by episode"
            rows={stats.data.episodes}
            rowKey={(e) => e.episode_id}
            columns={[
              { header: "Episode", cell: (e) => e.title },
              { header: "Plays", end: true, cell: (e) => e.plays },
              { header: "Completions", end: true, cell: (e) => e.completions },
            ]}
          />
        </>
      )}
    </Section>
  );
}

type ShowTab = "episodes" | "details" | "seasons" | "team" | "youtube" | "stats";

/** /studio/:podcastId */
export function StudioShowPage() {
  const { podcastId } = useParams();
  const show = useStudioShow(podcastId);
  const status = usePodcastStatus(podcastId ?? "");
  const [tab, setTab] = useState<ShowTab>("episodes");
  if (show.isPending) return <PageLoader />;
  if (show.isError) return <ErrorState error={show.error} />;
  const s = show.data;
  return (
    <div className="stack">
      <Seo title={`${s.title}: studio`} noIndex />
      <PageHeader
        eyebrow={<Link to="/studio">← Podcast studio</Link>}
        title={s.title}
        description={<StatusBadge status={s.status} />}
        actions={
          <>
            {s.status !== "published" ? (
              <ActionButton variant="primary" run={() => status.mutateAsync("publish")} success="Your show is live">
                Publish show
              </ActionButton>
            ) : (
              <ActionButton
                confirm="Archive the show? It stops appearing in listings."
                run={() => status.mutateAsync("archive")}
                success="Archived"
              >
                Archive
              </ActionButton>
            )}
            <ButtonLink to={`/podcasts/${s.slug}`} variant="secondary">
              View
            </ButtonLink>
            <AnchorButton href={`/api/v1/podcasts/${s.slug}/feed.xml`} variant="ghost" leading={<Rss size={16} />}>
              RSS
            </AnchorButton>
          </>
        }
      />
      <Tabs
        label="Studio"
        value={tab}
        onChange={setTab}
        items={[
          { value: "episodes", label: "Episodes" },
          { value: "details", label: "Details" },
          { value: "seasons", label: "Seasons" },
          { value: "team", label: "Team" },
          { value: "youtube", label: "YouTube" },
          { value: "stats", label: "Stats" },
        ]}
      />
      {tab === "episodes" && <EpisodesTab show={s} />}
      {tab === "details" && <DetailsTab show={s} />}
      {tab === "seasons" && <SeasonsTab show={s} />}
      {tab === "team" && <TeamTab show={s} />}
      {tab === "youtube" && <YouTubeTab show={s} />}
      {tab === "stats" && <StatsTab show={s} />}
    </div>
  );
}

// --------------------------------------------------------------------- an episode
function MediaUpload({ episode, kind }: { episode: Episode; kind: "audio" | "video" }) {
  const update = useUpdateEpisode(episode.id);
  const toast = useToast();
  const [progress, setProgress] = useState<number | null>(null);
  const [assetId, setAssetId] = useState<string | undefined>();
  const asset = useMediaAsset(assetId, true);
  const has = kind === "audio" ? episode.has_audio : episode.has_video;
  const onPick = async (file: File) => {
    setProgress(0);
    try {
      const uploaded = await uploadMedia(file, kind, setProgress);
      setAssetId(uploaded.id);
      await update.mutateAsync(kind === "audio" ? { audio_media_id: uploaded.id } : { video_media_id: uploaded.id });
      toast.success(`${kind === "audio" ? "Audio" : "Video"} uploaded. It's being processed.`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setProgress(null);
    }
  };
  return (
    <div className="stack" style={{ "--stack-gap": "var(--space-2)" } as React.CSSProperties}>
      <div className="cluster">
        <FilePicker
          accept={kind === "audio" ? AUDIO_TYPES : VIDEO_TYPES}
          maxMb={kind === "audio" ? 500 : 2048}
          loading={progress !== null}
          leading={<Upload size={16} />}
          onPick={(files) => files[0] && void onPick(files[0])}
        >
          {has ? `Replace ${kind}` : `Upload ${kind}`}
        </FilePicker>
        {has && <Badge tone="success">{kind === "audio" ? "Audio" : "Video"} attached</Badge>}
        {has && (
          <ActionButton
            variant="ghost"
            run={() => update.mutateAsync(kind === "audio" ? { audio_media_id: "" } : { video_media_id: "" })}
            success="Removed"
          >
            Remove
          </ActionButton>
        )}
      </div>
      {progress !== null && <progress value={progress} max={1} aria-label="Upload progress" />}
      {asset.data?.status === "processing" && <span className={m.small}>Processing… you can keep editing.</span>}
      {asset.data?.status === "failed" && (
        <Alert tone="error">Processing failed: {asset.data.error || "unsupported file"}</Alert>
      )}
      {kind === "video" && (
        <span className={m.small}>
          Uploaded videos are also posted to GistLoop's TikTok when this episode is published.
        </span>
      )}
    </div>
  );
}

function YouTubeLink({ episode, podcastId }: { episode: Episode; podcastId: string }) {
  const videos = useYouTubeVideos(podcastId);
  const set = useSetYouTubeVideo(episode.id);
  const remove = useRemoveYouTubeVideo(episode.id);
  const toast = useToast();
  const current = videos.data?.get(episode.id);
  const [url, setUrl] = useState("");
  return current ? (
    <div className="cluster">
      <a href={current.watch_url} target="_blank" rel="noopener noreferrer">
        <Youtube size={16} aria-hidden /> youtu.be/{current.video_id}
      </a>
      {current.imported && <Badge>Imported from your channel</Badge>}
      <ActionButton variant="ghost" run={() => remove.mutateAsync()} success="YouTube link removed">
        Remove
      </ActionButton>
    </div>
  ) : (
    <form
      className="cluster"
      onSubmit={(e) => {
        e.preventDefault();
        set.mutate(url.trim(), {
          onSuccess: () => (setUrl(""), toast.success("YouTube video linked")),
          onError: (err) => toast.error(errorMessage(err)),
        });
      }}
    >
      <label htmlFor="yt-link" className="visually-hidden">
        YouTube link
      </label>
      <Input id="yt-link" placeholder="https://youtu.be/…" value={url} onChange={(e) => setUrl(e.target.value)} />
      <Button type="submit" variant="secondary" loading={set.isPending} disabled={!url.trim()}>
        Link video
      </Button>
    </form>
  );
}

function EpisodeDetails({ episode, podcastId }: { episode: Episode; podcastId: string }) {
  const update = useUpdateEpisode(episode.id);
  const seasons = useSeasons(podcastId);
  const toast = useToast();
  const [form, setForm] = useState({
    title: episode.title,
    summary: episode.summary,
    show_notes: episode.show_notes,
    number: episode.number ? String(episode.number) : "",
    episode_type: episode.episode_type,
    explicit: episode.explicit,
    season: "",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const body: EpisodeWrite = {
      title: form.title,
      summary: form.summary,
      show_notes: form.show_notes,
      episode_type: form.episode_type,
      explicit: form.explicit,
      number: form.number ? Number(form.number) : null,
      ...(form.season ? { season: form.season } : {}),
    };
    update.mutate(body, { onSuccess: () => toast.success("Saved"), onError: (e) => toast.error(errorMessage(e)) });
  };
  return (
    <form className={m.form} onSubmit={onSubmit}>
      <Field label="Title">
        <Input value={form.title} onChange={set("title")} required />
      </Field>
      <Field label="Summary (shown in lists)">
        <Textarea maxLength={500} value={form.summary} onChange={set("summary")} />
      </Field>
      <Field label="Show notes" optional>
        <Textarea rows={6} value={form.show_notes} onChange={set("show_notes")} />
      </Field>
      <div className={m.formRow}>
        <Field label="Episode number" optional>
          <Input type="number" min={1} value={form.number} onChange={set("number")} />
        </Field>
        <Field label="Type">
          <Select value={form.episode_type} onChange={set("episode_type")}>
            <option value="full">Full episode</option>
            <option value="trailer">Trailer</option>
            <option value="bonus">Bonus</option>
          </Select>
        </Field>
        {(seasons.data?.length ?? 0) > 0 && (
          <Field label="Season" optional>
            <Select value={form.season} onChange={set("season")}>
              <option value="">{episode.season ? `Season ${episode.season} (unchanged)` : "No season"}</option>
              {seasons.data!.map((s) => (
                <option key={s.id} value={s.id}>
                  Season {s.number}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Checkbox
        label="Explicit"
        checked={form.explicit}
        onChange={(e) => setForm((f) => ({ ...f, explicit: e.target.checked }))}
      />
      <div>
        <Button type="submit" loading={update.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}

function Guests({ episode }: { episode: Episode }) {
  const add = useAddGuest(episode.id);
  const remove = useRemoveGuest(episode.id);
  const toast = useToast();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  return (
    <div className="stack">
      <ul className={m.list}>
        {episode.guests.map((g) => (
          <li key={g.id} className={m.item}>
            <div className={m.itemMain}>
              <strong>{g.name}</strong>
              <span className={m.small}>
                {[g.user?.handle && `@${g.user.handle}`, g.bio].filter(Boolean).join(" · ")}
              </span>
            </div>
            <ActionButton variant="ghost" run={() => remove.mutateAsync(g.id)} success="Removed">
              <Trash2 size={14} aria-hidden /> Remove
            </ActionButton>
          </li>
        ))}
      </ul>
      <PersonPicker
        label="Add a guest who's on GistLoop (they'll be asked to confirm)"
        onPick={(p) =>
          add.mutate(
            { name: p.display_name, user_id: p.id },
            { onSuccess: () => toast.success("Guest added"), onError: (e) => toast.error(errorMessage(e)) },
          )
        }
      />
      <form
        className="cluster"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(
            { name: name.trim(), bio: bio.trim() },
            {
              onSuccess: () => (setName(""), setBio(""), toast.success("Guest added")),
              onError: (err) => toast.error(errorMessage(err)),
            },
          );
        }}
      >
        <Field label="…or a guest who isn't">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Short bio" optional>
          <Input value={bio} onChange={(e) => setBio(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={!name.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

function TranscriptEditor({ episode }: { episode: Episode }) {
  const transcript = useTranscript(episode.id);
  const save = useSaveTranscript(episode.id);
  const generate = useGenerateTranscript(episode.id);
  const toast = useToast();
  const [content, setContent] = useState<string | null>(null);
  const [format, setFormat] = useState<"text" | "vtt" | "srt">("text");
  const text = content ?? transcript.data?.text ?? "";
  return (
    <div className="stack">
      {transcript.data && (
        <p className={m.small}>
          <StatusBadge
            status={transcript.data.status === "ready" ? "published" : transcript.data.status}
            label={humanize(transcript.data.status)}
          />{" "}
          {transcript.data.automatic && "Automatic. "}
          {transcript.data.error && `Error: ${transcript.data.error}`}
          {transcript.data.status === "ready" && (
            <a href={`/api/v1/podcasts/episodes/${episode.id}/transcript.vtt`}> Download captions (.vtt)</a>
          )}
        </p>
      )}
      <Field label="Transcript" hint="Paste plain text, or WebVTT / SRT captions with timings.">
        <Textarea rows={8} value={text} onChange={(e) => setContent(e.target.value)} />
      </Field>
      <div className="cluster">
        <Select
          value={format}
          onChange={(e) => setFormat(e.target.value as "text" | "vtt" | "srt")}
          aria-label="Format"
        >
          <option value="text">Plain text</option>
          <option value="vtt">WebVTT</option>
          <option value="srt">SRT</option>
        </Select>
        <Button
          loading={save.isPending}
          disabled={!text.trim()}
          onClick={() =>
            save.mutate(
              { content: text, format, language: "en" },
              {
                onSuccess: () => (setContent(null), toast.success("Transcript saved")),
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
        >
          Save transcript
        </Button>
        {episode.has_audio && (
          <ActionButton
            run={() => generate.mutateAsync("en")}
            success="Transcribing. It'll appear here when it's done."
          >
            Generate automatically
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function Clips({ episode }: { episode: Episode }) {
  const clips = useClips(episode.id);
  const create = useCreateClip(episode.id);
  const remove = useDeleteClip();
  const toast = useToast();
  const [form, setForm] = useState({ title: "", start: "", end: "" });
  const seconds = (value: string) => {
    const parts = value.split(":").map(Number);
    return parts.reduce((total, part) => total * 60 + (Number.isFinite(part) ? part : 0), 0);
  };
  return (
    <div className="stack">
      <form
        className="cluster"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { title: form.title.trim(), start_seconds: seconds(form.start), end_seconds: seconds(form.end) },
            {
              onSuccess: () => (setForm({ title: "", start: "", end: "" }), toast.success("Clip made")),
              onError: (err) => toast.error(errorMessage(err)),
            },
          );
        }}
      >
        <Field label="Clip title">
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </Field>
        <Field label="Start (m:ss)">
          <Input
            placeholder="1:30"
            value={form.start}
            onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
          />
        </Field>
        <Field label="End (m:ss)">
          <Input
            placeholder="2:45"
            value={form.end}
            onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
          />
        </Field>
        <Button type="submit" loading={create.isPending} disabled={!form.title.trim() || !form.end}>
          Make clip
        </Button>
      </form>
      <ul className={m.list}>
        {clips.data?.map((c) => (
          <li key={c.id} className={m.item}>
            <div className={m.itemMain}>
              <strong>{c.title}</strong>
              <span className={m.small}>
                {formatDuration(c.start_seconds)} – {formatDuration(c.end_seconds)}
              </span>
              {/* eslint-disable-next-line jsx-a11y-x/media-has-caption */}
              <audio controls preload="none" src={clipStreamUrl(c.id)} />
            </div>
            <ActionButton variant="ghost" run={() => remove.mutateAsync(c.id)} success="Clip deleted">
              Delete
            </ActionButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** /studio/:podcastId/episodes/:episodeId */
export function StudioEpisodePage() {
  const { podcastId = "", episodeId } = useParams();
  const episode = useStudioEpisode(episodeId);
  const videos = useYouTubeVideos(podcastId);
  const publish = usePublishEpisode(episodeId ?? "");
  const unpublish = useUnpublishEpisode(episodeId ?? "");
  const remove = useDeleteEpisode();
  const navigate = useNavigate();
  const [when, setWhen] = useState("");
  if (episode.isPending) return <PageLoader />;
  if (episode.isError) return <ErrorState error={episode.error} />;
  const e = episode.data;
  const hasMedia = e.has_audio || e.has_video || videos.data?.has(e.id);
  return (
    <div className="stack">
      <Seo title={`${e.title}: studio`} noIndex />
      <PageHeader
        eyebrow={<Link to={`/studio/${podcastId}`}>← Back to the show</Link>}
        title={e.title}
        description={
          <span className="cluster">
            <StatusBadge status={e.status} />
            {e.publish_at && e.status === "scheduled" && <span>Goes live {formatDateTime(e.publish_at)}</span>}
          </span>
        }
      />
      <Section
        title="Media"
        description="Upload audio and/or video, or link a YouTube video. At least one is needed to publish."
      >
        <h3 style={{ fontSize: "var(--text-base)" }}>Audio</h3>
        <MediaUpload episode={e} kind="audio" />
        <h3 style={{ fontSize: "var(--text-base)" }}>Video</h3>
        <MediaUpload episode={e} kind="video" />
        <h3 style={{ fontSize: "var(--text-base)" }}>YouTube</h3>
        <YouTubeLink episode={e} podcastId={podcastId} />
      </Section>
      <Section
        title="Publish"
        description="Published public episodes are also shared on GistLoop's social media pages."
      >
        {e.status === "published" ? (
          <ActionButton
            confirm="Unpublish this episode? Listeners won't see it."
            run={() => unpublish.mutateAsync()}
            success="Unpublished"
          >
            Unpublish
          </ActionButton>
        ) : (
          <div className="cluster">
            <ActionButton
              variant="primary"
              disabled={!hasMedia}
              run={() => publish.mutateAsync(null)}
              success="Published"
            >
              Publish now
            </ActionButton>
            <Field label="Or schedule for" optional>
              <Input type="datetime-local" value={when} onChange={(ev) => setWhen(ev.target.value)} />
            </Field>
            <ActionButton
              disabled={!hasMedia || !when}
              run={() => publish.mutateAsync(new Date(when).toISOString())}
              success="Scheduled"
            >
              Schedule
            </ActionButton>
          </div>
        )}
        {!hasMedia && <p className={m.small}>Add audio, video or a YouTube link first.</p>}
      </Section>
      <Section title="Details">
        <EpisodeDetails key={e.id} episode={e} podcastId={podcastId} />
      </Section>
      <Section title="Guests">
        <Guests episode={e} />
      </Section>
      <Section title="Transcript and captions">
        <TranscriptEditor episode={e} />
      </Section>
      {(e.has_audio || e.has_video) && (
        <Section title="Clips" description="Short highlights (up to 3 minutes) people can share.">
          <Clips episode={e} />
        </Section>
      )}
      <Section title="Delete episode">
        <ActionButton
          variant="danger"
          confirm="Delete this episode for good?"
          run={async () => {
            await remove.mutateAsync(e.id);
            navigate(`/studio/${podcastId}`);
          }}
          success="Episode deleted"
        >
          Delete episode
        </ActionButton>
      </Section>
    </div>
  );
}

/** /podcasts/guest-spots/:guestId: confirm (or decline) appearing as a guest. */
export function GuestSpotPage() {
  const { guestId = "" } = useParams();
  const respond = useRespondToGuestSpot();
  const navigate = useNavigate();
  const toast = useToast();
  const answer = (accept: boolean) =>
    respond.mutate(
      { guestId, accept },
      {
        onSuccess: () => {
          toast.success(accept ? "Confirmed. The episode shows on your profile." : "Declined");
          navigate("/notifications");
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  return (
    <Card>
      <Seo title="Guest appearance" noIndex />
      <div className="stack">
        <h1 style={{ fontSize: "var(--text-xl)" }}>You were added as a guest on a podcast episode</h1>
        <p className="muted">Confirm to be credited on the episode, or decline if it wasn't you.</p>
        <div className="cluster">
          <Button loading={respond.isPending && respond.variables?.accept} onClick={() => answer(true)}>
            Confirm
          </Button>
          <Button
            variant="secondary"
            loading={respond.isPending && !respond.variables?.accept}
            onClick={() => answer(false)}
          >
            Decline
          </Button>
        </div>
      </div>
    </Card>
  );
}
