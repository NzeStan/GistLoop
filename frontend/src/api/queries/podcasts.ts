import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { type Episode, type Podcast, asPage } from "../types";

export const podcastKeys = {
  list: (q: string) => ["podcasts", q] as const,
  detail: (slug: string) => ["podcast", slug] as const,
  episodes: (podcastId: string) => ["episodes", podcastId] as const,
};

export function usePodcasts(q = "") {
  return useQuery({
    queryKey: podcastKeys.list(q),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<Podcast>(await unwrap(api.GET("/api/v1/podcasts/", { params: { query: { q: q || undefined } } }))),
  });
}

export function usePodcast(slug: string | undefined) {
  return useQuery({
    queryKey: podcastKeys.detail(slug ?? ""),
    enabled: Boolean(slug),
    queryFn: () => unwrap(api.GET("/api/v1/podcasts/by-slug/{slug}/", { params: { path: { slug: slug! } } })),
  });
}

export function useEpisodes(podcastId: string | undefined) {
  return useQuery({
    queryKey: podcastKeys.episodes(podcastId ?? ""),
    enabled: Boolean(podcastId),
    queryFn: async () =>
      asPage<Episode>(
        await unwrap(
          api.GET("/api/v1/podcasts/{podcast_id}/episodes/", {
            params: { path: { podcast_id: podcastId! } },
          }),
        ),
      ).results,
  });
}

export function useToggleSubscription(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ podcastId, subscribed }: { podcastId: string; subscribed: boolean }) =>
      subscribed
        ? unwrap(
            api.DELETE("/api/v1/podcasts/{podcast_id}/subscription/", {
              params: { path: { podcast_id: podcastId } },
            }),
          )
        : unwrap(
            api.POST("/api/v1/podcasts/{podcast_id}/subscription/", {
              params: { path: { podcast_id: podcastId } },
            }),
          ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: podcastKeys.detail(slug) }),
  });
}

/** Public episode audio (the API redirects to a short-lived signed media URL). */
export const episodeAudioUrl = (episodeId: string) => `/api/v1/podcasts/episodes/${episodeId}/stream/`;
export const podcastCoverUrl = (podcastId: string) => `/api/v1/podcasts/${podcastId}/cover/`;
