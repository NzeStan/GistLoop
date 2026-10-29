import { useQuery } from "@tanstack/react-query";
import { Headphones, Mic, Rss } from "lucide-react";
import { useState } from "react";
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
import type { Podcast } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Seo } from "@/components/Seo";
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

export default function PodcastsPage() {
  const [q, setQ] = useState("");
  const podcasts = usePodcasts(useDebounced(q));
  return (
    <BrowseShell
      eyebrow="Podcasts"
      title="Campus voices, on demand"
      description="Shows made by students, lecturers and creators: stories, careers, faith, tech and culture."
    >
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

function Episodes({ podcastId }: { podcastId: string }) {
  const episodes = useEpisodes(podcastId);
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
      {published.map((episode) => (
        <div key={episode.id} className={styles.episode} id={`episode-${episode.id}`}>
          <div className="cluster" style={{ justifyContent: "space-between" }}>
            <h3 style={{ fontSize: "var(--text-lg)" }}>
              {episode.number ? `${episode.number}. ` : ""}
              {episode.title}
            </h3>
            <span className="muted" style={{ fontSize: "var(--text-sm)" }}>
              {episode.published_at && formatDate(episode.published_at)}
              {episode.duration_seconds ? ` · ${formatDuration(episode.duration_seconds)}` : ""}
            </span>
          </div>
          {episode.summary && <p className="muted">{episode.summary}</p>}
          {episode.has_audio && (
            // Captions come from the transcript when there is one (also linked below as text).
            // eslint-disable-next-line jsx-a11y-x/media-has-caption
            <audio controls preload="none" src={episodeAudioUrl(episode.id)}>
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
          )}
          {episode.has_transcript && (
            <a href={`/api/v1/podcasts/episodes/${episode.id}/transcript.vtt`} style={{ fontSize: "var(--text-sm)" }}>
              Read the transcript
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function PodcastView({ podcast }: { podcast: Podcast }) {
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
            <Episodes podcastId={podcast.id} />
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
