import { useRecordView } from "@/api/queries/analytics";
import { useQuery } from "@tanstack/react-query";
import { Headphones, Mic, Rss } from "lucide-react";
import { useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router";

import { api, unwrap } from "@/api/client";
import { errorMessage } from "@/api/errors";
import {
  episodeAudioUrl,
  podcastCoverUrl,
  useEpisodes,
  usePodcast,
  usePodcasts,
  useToggleSubscription,
} from "@/api/queries/podcasts";
import { clipStreamUrl, recordPlay, useClips, useMyPodcastSubscriptions, useYouTubeVideos } from "@/api/queries/studio";
import type { Episode, Podcast } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Seo } from "@/components/Seo";
import { ShareMenu } from "@/components/ShareMenu";
import { Badge } from "@/components/ui/Badge";
import { AnchorButton, Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Form";
import { Img } from "@/components/ui/Img";
import { PageLoader, Skeleton, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { brand } from "@/config/brand";
import styles from "@/features/content/Browse.module.css";
import { BrowseShell } from "@/features/content/BrowseShell";
import { useDebounced } from "@/lib/hooks";
import { formatDate, formatDuration, pluralize } from "@/lib/format";

const cover = (podcast: Podcast) => (podcast.has_cover ? podcastCoverUrl(podcast.id) : undefined);

export function PodcastCard({ podcast }: { podcast: Podcast }) {
  return (
    <Card padded={false} interactive>
      <Link to={`/podcasts/${podcast.slug}`} className={styles.tile}>
        <Img
          src={cover(podcast)}
          fallback={brand.assets.fallbacks.podcastCover}
          alt=""
          className={`${styles.tileMedia} ${styles.tileMediaSquare}`}
        />
        <div className={styles.tileBody}>
          <h3 className={styles.tileTitle}>{podcast.title}</h3>
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
            {podcast.author_name}
          </p>
          <div className={styles.tileMeta}>
            {podcast.category && <Badge>{podcast.category}</Badge>}
            <span className={styles.metaItem}>
              <Headphones size={14} aria-hidden /> {pluralize(podcast.subscriber_count, "subscriber")}
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
}

function YourSubscriptions() {
  const subs = useMyPodcastSubscriptions();
  if (!subs.data?.length) return null;
  return (
    <section className="stack">
      <h2 style={{ fontSize: "var(--text-lg)" }}>Your subscriptions</h2>
      <div className={styles.grid}>
        {subs.data.slice(0, 6).map((podcast) => (
          <PodcastCard key={podcast.id} podcast={podcast} />
        ))}
      </div>
    </section>
  );
}

export default function PodcastsPage() {
  const { status } = useAuth();
  const [q, setQ] = useState("");
  const podcasts = usePodcasts(useDebounced(q));
  return (
    <BrowseShell
      eyebrow="Podcasts"
      title="Campus voices, on demand"
      description="Shows made by students, lecturers and creators: stories, careers, faith, tech and culture."
      actions={
        status === "signed-in" ? (
          <ButtonLink to="/studio" leading={<Mic size={16} />}>
            Podcast studio
          </ButtonLink>
        ) : undefined
      }
    >
      {status === "signed-in" && !q && <YourSubscriptions />}
      <Seo title="Podcasts" description="Listen to podcasts made by students and creators on GistLoop." />
      <div className={styles.toolbar}>
        <label htmlFor="podcast-search" className="visually-hidden">
          Search podcasts
        </label>
        <Input
          id="podcast-search"
          type="search"
          placeholder="Search podcasts"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {podcasts.isPending ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height="22rem" radius="var(--radius-lg)" />
          ))}
        </div>
      ) : podcasts.isError ? (
        <ErrorState error={podcasts.error} onRetry={() => void podcasts.refetch()} />
      ) : podcasts.data.results.length === 0 ? (
        <EmptyState icon={Mic} title="No podcasts found">
          Check back soon for new shows.
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {podcasts.data.results.map((podcast) => (
            <PodcastCard key={podcast.id} podcast={podcast} />
          ))}
        </div>
      )}
    </BrowseShell>
  );
}

/** YouTube's privacy-enhanced player: no cookies until someone presses play. */
function YouTubePlayer({ videoId, title }: { videoId: string; title: string }) {
  return (
    <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0`}
        title={title}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
      />
    </div>
  );
}

/** Audio with listens counted (once at the start, again at the end for completion stats). */
function EpisodeAudio({ episode }: { episode: Episode }) {
  const started = useRef(false);
  return (
    // Captions come from the transcript when there is one (also linked below as text).
    // eslint-disable-next-line jsx-a11y-x/media-has-caption
    <audio
      controls
      preload="none"
      src={episodeAudioUrl(episode.id)}
      onPlay={(e) => {
        if (started.current) return;
        started.current = true;
        void recordPlay(episode.id, e.currentTarget.currentTime);
      }}
      onEnded={(e) => void recordPlay(episode.id, e.currentTarget.duration)}
    >
      {episode.has_transcript && (
        <track
          kind="captions"
          srcLang="en"
          label="Transcript"
          src={`/api/v1/podcasts/episodes/${episode.id}/transcript.vtt`}
        />
      )}
      Your browser can't play this audio.
    </audio>
  );
}

function EpisodeClips({ episodeId }: { episodeId: string }) {
  const clips = useClips(episodeId);
  if (!clips.data?.length) return null;
  return (
    <details>
      <summary style={{ cursor: "pointer", fontSize: "var(--text-sm)" }}>Highlights ({clips.data.length})</summary>
      <ul className="stack" style={{ listStyle: "none", padding: 0, marginTop: "var(--space-2)" }}>
        {clips.data.map((c) => (
          <li key={c.id}>
            <strong style={{ fontSize: "var(--text-sm)" }}>{c.title}</strong>
            {/* eslint-disable-next-line jsx-a11y-x/media-has-caption */}
            <audio controls preload="none" src={clipStreamUrl(c.id)} style={{ display: "block", width: "100%" }} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function Episodes({ podcast }: { podcast: Podcast }) {
  const episodes = useEpisodes(podcast.id);
  const videos = useYouTubeVideos(podcast.id);
  if (episodes.isPending) return <Spinner />;
  if (episodes.isError) return <ErrorState error={episodes.error} />;
  const published = episodes.data.filter((e) => e.status === "published");
  if (published.length === 0) {
    return (
      <EmptyState icon={Mic} title="No episodes yet">
        Subscribe to hear about the first one.
      </EmptyState>
    );
  }
  return (
    <div>
      {published.map((episode) => {
        const video = videos.data?.get(episode.id);
        return (
          <div key={episode.id} className={styles.episode} id={`episode-${episode.id}`}>
            <div className="cluster" style={{ justifyContent: "space-between" }}>
              <h3 style={{ fontSize: "var(--text-lg)" }}>
                {episode.number ? `${episode.number}. ` : ""}
                {episode.title}
              </h3>
              <span className="cluster">
                <span className="muted" style={{ fontSize: "var(--text-sm)" }}>
                  {episode.published_at && formatDate(episode.published_at)}
                  {episode.duration_seconds ? ` · ${formatDuration(episode.duration_seconds)}` : ""}
                </span>
                <ShareMenu
                  compact
                  variant="ghost"
                  title={`${episode.title} (${podcast.title})`}
                  path={`/podcasts/episode/${episode.id}`}
                />
              </span>
            </div>
            {episode.summary && <p className="muted">{episode.summary}</p>}
            {video && <YouTubePlayer videoId={video.video_id} title={episode.title} />}
            {episode.has_audio && <EpisodeAudio episode={episode} />}
            {episode.guests.length > 0 && (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                With{" "}
                {episode.guests.map((g, i) => (
                  <span key={g.id}>
                    {i > 0 && ", "}
                    {g.user?.handle ? <Link to={`/u/${g.user.handle}`}>{g.name}</Link> : g.name}
                  </span>
                ))}
              </p>
            )}
            {episode.show_notes && (
              <details>
                <summary style={{ cursor: "pointer", fontSize: "var(--text-sm)" }}>Show notes</summary>
                <p className="pre-wrap" style={{ marginTop: "var(--space-2)" }}>
                  {episode.show_notes}
                </p>
              </details>
            )}
            {(episode.has_audio || episode.has_video) && <EpisodeClips episodeId={episode.id} />}
            {episode.has_transcript && (
              <a href={`/api/v1/podcasts/episodes/${episode.id}/transcript.vtt`} style={{ fontSize: "var(--text-sm)" }}>
                Read the transcript
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PodcastView({ podcast }: { podcast: Podcast }) {
  useRecordView("podcast.show", podcast.id);
  const { status } = useAuth();
  const toggle = useToggleSubscription(podcast.slug);
  const toast = useToast();
  const subscribed = Boolean((podcast.viewer as { subscribed?: boolean } | undefined)?.subscribed);
  return (
    <article>
      <Seo title={podcast.title} description={podcast.description.slice(0, 160)} />
      <div className={styles.detailLayout} style={{ marginTop: 0 }}>
        <Card>
          <div className="stack">
            <h1 className={styles.detailTitle}>{podcast.title}</h1>
            <p className="muted">by {podcast.author_name}</p>
            <p className="pre-wrap">{podcast.description}</p>
            <h2 style={{ fontSize: "var(--text-xl)", marginTop: "var(--space-4)" }}>Episodes</h2>
            <Episodes podcast={podcast} />
          </div>
        </Card>
        <div className="stack">
          <Img
            src={cover(podcast)}
            fallback={brand.assets.fallbacks.podcastCover}
            alt={`${podcast.title} cover art`}
            className={styles.mainImage}
            style={{ aspectRatio: "1" }}
            loading="eager"
          />
          {status === "signed-in" ? (
            <Button
              block
              variant={subscribed ? "secondary" : "primary"}
              loading={toggle.isPending}
              onClick={() =>
                toggle.mutate(
                  { podcastId: podcast.id, subscribed },
                  {
                    onSuccess: () =>
                      toast.success(
                        subscribed ? "Unsubscribed" : "Subscribed! New episodes will show in your notifications.",
                      ),
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              {subscribed ? "Subscribed" : "Subscribe"}
            </Button>
          ) : (
            <ButtonLink to={`/login?next=/podcasts/${podcast.slug}`} block>
              Sign in to subscribe
            </ButtonLink>
          )}
          <ShareMenu title={podcast.title} path={`/podcasts/${podcast.slug}`} />
          <AnchorButton
            href={`/api/v1/podcasts/${podcast.slug}/feed.xml`}
            variant="secondary"
            block
            leading={<Rss size={16} />}
          >
            RSS feed
          </AnchorButton>
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
            {pluralize(podcast.subscriber_count, "subscriber")} · {podcast.category} · {podcast.language.toUpperCase()}
            {podcast.explicit && " · Explicit"}
          </p>
        </div>
      </div>
    </article>
  );
}

/** /podcasts/:slug */
export function PodcastPage() {
  const { slug } = useParams();
  const podcast = usePodcast(slug);
  if (podcast.isPending) return <PageLoader />;
  if (podcast.isError) return <ErrorState error={podcast.error} onRetry={() => void podcast.refetch()} />;
  return <PodcastView podcast={podcast.data} />;
}

/** /podcasts/id/:podcastId and /podcasts/episode/:episodeId → canonical show URL. */
export function PodcastRedirectPage({ kind }: { kind: "show" | "episode" }) {
  const { podcastId, episodeId } = useParams();
  const target = useQuery({
    queryKey: ["podcastRedirect", kind, podcastId ?? episodeId],
    queryFn: async () => {
      let showId = podcastId!;
      let anchor = "";
      if (kind === "episode") {
        const episode = await unwrap(
          api.GET("/api/v1/podcasts/episodes/{episode_id}/", {
            params: { path: { episode_id: episodeId! } },
          }),
        );
        showId = episode.podcast;
        anchor = `#episode-${episode.id}`;
      }
      const show = await unwrap(
        api.GET("/api/v1/podcasts/{podcast_id}/", { params: { path: { podcast_id: showId } } }),
      );
      return `/podcasts/${show.slug}${anchor}`;
    },
  });
  if (target.isPending) return <PageLoader />;
  if (target.isError) return <ErrorState error={target.error} />;
  return <Navigate to={target.data} replace />;
}

export const PodcastShowRedirect = () => <PodcastRedirectPage kind="show" />;
export const PodcastEpisodeRedirect = () => <PodcastRedirectPage kind="episode" />;
