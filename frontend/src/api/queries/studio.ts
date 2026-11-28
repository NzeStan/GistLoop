/** Making podcasts: shows, episodes, media uploads, YouTube videos, guests, transcripts, clips and stats. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { ApiError } from "../errors";
import type { components } from "../schema";
import { type Episode, type Podcast, asPage } from "../types";
import { uploadFile } from "../upload";

type S = components["schemas"];
export type MediaAsset = S["MediaAsset"];
export type Season = S["PodcastSeason"];
export type PodcastMember = S["PodcastMember"];
export type Clip = S["PodcastClip"];
export type Transcript = S["PodcastTranscript"];
export type PodcastAnalytics = S["PodcastAnalytics"];
export type YouTubeVideo = S["YouTubeEpisodeVideo"];
export type YouTubeChannel = S["YouTubeChannel"];
export type ShowWrite = S["PodcastShowWriteRequest"];
export type EpisodeWrite = S["PodcastEpisodeWriteRequest"];

export const studioKeys = {
  mine: ["myPodcasts"] as const,
  subscriptions: ["podcastSubscriptions"] as const,
  show: (id: string) => ["studioShow", id] as const,
  episode: (id: string) => ["studioEpisode", id] as const,
  part: (id: string, part: string) => ["studioShow", id, part] as const,
  episodePart: (id: string, part: string) => ["studioEpisode", id, part] as const,
  youtube: (podcastId: string) => ["youtube", podcastId] as const,
  media: ["myMedia"] as const,
};

function useStudioMutation<A, R>(fn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ["myPodcasts", "studioShow", "studioEpisode", "youtube", "episodes", "podcast", "podcasts"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useMyPodcasts() {
  return useQuery({
    queryKey: studioKeys.mine,
    queryFn: async () => asPage<Podcast>(await unwrap(api.GET("/api/v1/me/podcasts/"))).results,
  });
}

export function useMyPodcastSubscriptions(enabled = true) {
  return useQuery({
    queryKey: studioKeys.subscriptions,
    enabled,
    queryFn: async () => asPage<Podcast>(await unwrap(api.GET("/api/v1/me/podcast-subscriptions/"))).results,
  });
}

export function useStudioShow(id: string | undefined) {
  return useQuery({
    queryKey: studioKeys.show(id ?? ""),
    enabled: Boolean(id),
    queryFn: () => unwrap(api.GET("/api/v1/podcasts/{podcast_id}/", { params: { path: { podcast_id: id! } } })),
  });
}

export function useStudioEpisodes(id: string | undefined) {
  return useQuery({
    queryKey: studioKeys.part(id ?? "", "episodes"),
    enabled: Boolean(id),
    queryFn: async () =>
      asPage<Episode>(
        await unwrap(api.GET("/api/v1/podcasts/{podcast_id}/episodes/", { params: { path: { podcast_id: id! } } })),
      ).results,
  });
}

export function useStudioEpisode(id: string | undefined) {
  return useQuery({
    queryKey: studioKeys.episode(id ?? ""),
    enabled: Boolean(id),
    queryFn: () =>
      unwrap(api.GET("/api/v1/podcasts/episodes/{episode_id}/", { params: { path: { episode_id: id! } } })),
  });
}

export const useCreatePodcast = () =>
  useStudioMutation((body: ShowWrite) => unwrap(api.POST("/api/v1/podcasts/", { body })));

export const useUpdatePodcast = (id: string) =>
  useStudioMutation((body: S["PatchedPodcastShowWriteRequest"]) =>
    unwrap(api.PATCH("/api/v1/podcasts/{podcast_id}/", { params: { path: { podcast_id: id } }, body })),
  );

export const usePodcastStatus = (id: string) =>
  useStudioMutation((action: "publish" | "archive") =>
    unwrap(
      api.POST("/api/v1/podcasts/{podcast_id}/status/", { params: { path: { podcast_id: id } }, body: { action } }),
    ),
  );

export const useTransferPodcast = (id: string) =>
  useStudioMutation((userId: string) =>
    unwrap(
      api.POST("/api/v1/podcasts/{podcast_id}/transfer-ownership/", {
        params: { path: { podcast_id: id } },
        body: { user_id: userId },
      }),
    ),
  );

// ---------------------------------------------------------------------- seasons
export function useSeasons(id: string | undefined) {
  return useQuery({
    queryKey: studioKeys.part(id ?? "", "seasons"),
    enabled: Boolean(id),
    queryFn: async () =>
      asPage<Season>(
        await unwrap(api.GET("/api/v1/podcasts/{podcast_id}/seasons/", { params: { path: { podcast_id: id! } } })),
      ).results,
  });
}

export const useCreateSeason = (id: string) =>
  useStudioMutation((body: S["PodcastSeasonWriteRequest"]) =>
    unwrap(api.POST("/api/v1/podcasts/{podcast_id}/seasons/", { params: { path: { podcast_id: id } }, body })),
  );

// ------------------------------------------------------------------------ team
export function usePodcastMembers(id: string | undefined) {
  return useQuery({
    queryKey: studioKeys.part(id ?? "", "members"),
    enabled: Boolean(id),
    queryFn: async () =>
      asPage<PodcastMember>(
        await unwrap(api.GET("/api/v1/podcasts/{podcast_id}/members/", { params: { path: { podcast_id: id! } } })),
      ).results,
  });
}

export const useAddPodcastMember = (id: string) =>
  useStudioMutation((body: S["PodcastMemberWriteRequest"]) =>
    unwrap(api.POST("/api/v1/podcasts/{podcast_id}/members/", { params: { path: { podcast_id: id } }, body })),
  );

export const useRemovePodcastMember = (id: string) =>
  useStudioMutation((userId: string) =>
    unwrap(
      api.DELETE("/api/v1/podcasts/{podcast_id}/members/{user_id}/", {
        params: { path: { podcast_id: id, user_id: userId } },
      }),
    ),
  );

// --------------------------------------------------------------------- episodes
export const useCreateEpisode = (podcastId: string) =>
  useStudioMutation((body: EpisodeWrite) =>
    unwrap(api.POST("/api/v1/podcasts/{podcast_id}/episodes/", { params: { path: { podcast_id: podcastId } }, body })),
  );

export const useUpdateEpisode = (episodeId: string) =>
  useStudioMutation((body: S["PatchedPodcastEpisodeWriteRequest"]) =>
    unwrap(api.PATCH("/api/v1/podcasts/episodes/{episode_id}/", { params: { path: { episode_id: episodeId } }, body })),
  );

export const useDeleteEpisode = () =>
  useStudioMutation((episodeId: string) =>
    unwrap(api.DELETE("/api/v1/podcasts/episodes/{episode_id}/", { params: { path: { episode_id: episodeId } } })),
  );

/** Publish (now or at ``publishAt``). Goes through GistLoop so YouTube-only episodes can be published. */
export const usePublishEpisode = (episodeId: string) =>
  useStudioMutation((publishAt: string | null) =>
    unwrap(
      api.POST("/api/v1/youtube/episodes/{episode_id}/publish/", {
        params: { path: { episode_id: episodeId } },
        body: { publish_at: publishAt },
      }),
    ),
  );

export const useUnpublishEpisode = (episodeId: string) =>
  useStudioMutation(() =>
    unwrap(
      api.POST("/api/v1/podcasts/episodes/{episode_id}/unpublish/", {
        params: { path: { episode_id: episodeId } },
        body: {},
      }),
    ),
  );

export const useAddGuest = (episodeId: string) =>
  useStudioMutation((body: S["PodcastGuestWriteRequest"]) =>
    unwrap(
      api.POST("/api/v1/podcasts/episodes/{episode_id}/guests/", { params: { path: { episode_id: episodeId } }, body }),
    ),
  );

export const useRemoveGuest = (episodeId: string) =>
  useStudioMutation((guestId: string) =>
    unwrap(
      api.DELETE("/api/v1/podcasts/episodes/{episode_id}/guests/{guest_id}/", {
        params: { path: { episode_id: episodeId, guest_id: guestId } },
      }),
    ),
  );

export const useRespondToGuestSpot = () =>
  useStudioMutation(({ guestId, accept }: { guestId: string; accept: boolean }) =>
    unwrap(
      api.POST("/api/v1/podcasts/guest-spots/{guest_id}/respond/", {
        params: { path: { guest_id: guestId } },
        body: { accept },
      }),
    ),
  );

// -------------------------------------------------------------------- transcripts
export function useTranscript(episodeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: studioKeys.episodePart(episodeId ?? "", "transcript"),
    enabled: Boolean(episodeId) && enabled,
    retry: false,
    queryFn: async () => {
      try {
        return await unwrap(
          api.GET("/api/v1/podcasts/episodes/{episode_id}/transcript/", {
            params: { path: { episode_id: episodeId! } },
          }),
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}

export const useSaveTranscript = (episodeId: string) =>
  useStudioMutation((body: S["PodcastTranscriptWriteRequest"]) =>
    unwrap(
      api.PUT("/api/v1/podcasts/episodes/{episode_id}/transcript/", {
        params: { path: { episode_id: episodeId } },
        body,
      }),
    ),
  );

export const useGenerateTranscript = (episodeId: string) =>
  useStudioMutation((language: string) =>
    unwrap(
      api.POST("/api/v1/podcasts/episodes/{episode_id}/transcript/generate/", {
        params: { path: { episode_id: episodeId } },
        body: { language },
      }),
    ),
  );

// --------------------------------------------------------------------------- clips
export function useClips(episodeId: string | undefined) {
  return useQuery({
    queryKey: studioKeys.episodePart(episodeId ?? "", "clips"),
    enabled: Boolean(episodeId),
    queryFn: async () =>
      asPage<Clip>(
        await unwrap(
          api.GET("/api/v1/podcasts/episodes/{episode_id}/clips/", { params: { path: { episode_id: episodeId! } } }),
        ),
      ).results,
  });
}

export const useCreateClip = (episodeId: string) =>
  useStudioMutation((body: S["PodcastClipWriteRequest"]) =>
    unwrap(
      api.POST("/api/v1/podcasts/episodes/{episode_id}/clips/", { params: { path: { episode_id: episodeId } }, body }),
    ),
  );

export const useDeleteClip = () =>
  useStudioMutation((clipId: string) =>
    unwrap(api.DELETE("/api/v1/podcasts/clips/{clip_id}/", { params: { path: { clip_id: clipId } } })),
  );

export const clipStreamUrl = (clipId: string) => `/api/v1/podcasts/clips/${clipId}/stream/`;

// ----------------------------------------------------------------------- stats
export function usePodcastAnalytics(id: string | undefined, from?: string, to?: string) {
  return useQuery({
    queryKey: [...studioKeys.part(id ?? "", "analytics"), from ?? "", to ?? ""],
    enabled: Boolean(id),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/podcasts/{podcast_id}/analytics/", {
          params: { path: { podcast_id: id! }, query: { from: from || undefined, to: to || undefined } },
        }),
      ),
  });
}

/** Count a listen (the API de-duplicates and works out completions). */
export async function recordPlay(episodeId: string, positionSeconds: number): Promise<void> {
  await unwrap(
    api.POST("/api/v1/podcasts/episodes/{episode_id}/plays/", {
      params: { path: { episode_id: episodeId } },
      body: { position_seconds: Math.max(0, Math.round(positionSeconds)) },
    }),
  ).catch(() => undefined);
}

// ---------------------------------------------------------------------- YouTube
export function useYouTubeVideos(podcastId: string | undefined) {
  return useQuery({
    queryKey: studioKeys.youtube(podcastId ?? ""),
    enabled: Boolean(podcastId),
    queryFn: async () => {
      const videos = await unwrap(api.GET("/api/v1/youtube/episodes/", { params: { query: { podcast: podcastId! } } }));
      return new Map(videos.map((v) => [v.episode_id, v]));
    },
  });
}

export const useSetYouTubeVideo = (episodeId: string) =>
  useStudioMutation((url: string) =>
    unwrap(
      api.PUT("/api/v1/youtube/episodes/{episode_id}/", { params: { path: { episode_id: episodeId } }, body: { url } }),
    ),
  );

export const useRemoveYouTubeVideo = (episodeId: string) =>
  useStudioMutation(() =>
    unwrap(api.DELETE("/api/v1/youtube/episodes/{episode_id}/", { params: { path: { episode_id: episodeId } } })),
  );

export function useYouTubeChannel(podcastId: string | undefined) {
  return useQuery({
    queryKey: [...studioKeys.youtube(podcastId ?? ""), "channel"],
    enabled: Boolean(podcastId),
    retry: false,
    queryFn: async () => {
      try {
        return await unwrap(
          api.GET("/api/v1/youtube/podcasts/{podcast_id}/channel/", { params: { path: { podcast_id: podcastId! } } }),
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}

export const useConnectChannel = (podcastId: string) =>
  useStudioMutation((body: S["YouTubeChannelWriteRequest"]) =>
    unwrap(
      api.PUT("/api/v1/youtube/podcasts/{podcast_id}/channel/", { params: { path: { podcast_id: podcastId } }, body }),
    ),
  );

export const useDisconnectChannel = (podcastId: string) =>
  useStudioMutation(() =>
    unwrap(
      api.DELETE("/api/v1/youtube/podcasts/{podcast_id}/channel/", { params: { path: { podcast_id: podcastId } } }),
    ),
  );

export const useSyncChannel = (podcastId: string) =>
  useStudioMutation(() =>
    unwrap(
      api.POST("/api/v1/youtube/podcasts/{podcast_id}/channel/sync/", { params: { path: { podcast_id: podcastId } } }),
    ),
  );

// ------------------------------------------------------------------ media library
export function useMyMedia() {
  return useQuery({
    queryKey: studioKeys.media,
    queryFn: async () => asPage<MediaAsset>(await unwrap(api.GET("/api/v1/media/"))),
  });
}

export function useMediaAsset(id: string | undefined, poll = false) {
  return useQuery({
    queryKey: [...studioKeys.media, id ?? ""],
    enabled: Boolean(id),
    refetchInterval: (query) => (poll && query.state.data?.status === "processing" ? 3000 : false),
    queryFn: () => unwrap(api.GET("/api/v1/media/{asset_id}/", { params: { path: { asset_id: id! } } })),
  });
}

export const useDeleteMedia = () =>
  useStudioMutation((id: string) =>
    unwrap(api.DELETE("/api/v1/media/{asset_id}/", { params: { path: { asset_id: id } } })),
  );

export const useClipMedia = () =>
  useStudioMutation(({ id, start, end }: { id: string; start: number; end: number }) =>
    unwrap(
      api.POST("/api/v1/media/{asset_id}/clips/", {
        params: { path: { asset_id: id } },
        body: { start_seconds: start, end_seconds: end },
      }),
    ),
  );

/**
 * Upload audio or video. Large files go straight to object storage when the server offers direct
 * uploads; otherwise through the API. ``onProgress`` gets 0–1.
 */
export async function uploadMedia(
  file: File,
  kind: "audio" | "video" | "image",
  onProgress?: (fraction: number) => void,
): Promise<MediaAsset> {
  if (file.size > 25 * 1024 * 1024) {
    try {
      const slot = await unwrap(
        api.POST("/api/v1/media/uploads/", {
          body: { kind, mime_type: file.type || "application/octet-stream", size: file.size, filename: file.name },
        }),
      );
      await putWithProgress(slot.url, slot.method, (slot.headers ?? {}) as Record<string, string>, file, onProgress);
      return await unwrap(
        api.POST("/api/v1/media/uploads/{upload_id}/complete/", { params: { path: { upload_id: slot.upload_id } } }),
      );
    } catch (error) {
      // This server has no direct uploads: send it through the API instead.
      if (!(error instanceof ApiError) || error.code !== "direct_uploads_disabled") throw error;
    }
  }
  onProgress?.(0.1);
  const asset = await uploadFile<MediaAsset>("/api/v1/media/", file, { kind });
  onProgress?.(1);
  return asset;
}

function putWithProgress(
  url: string,
  method: string,
  headers: Record<string, string>,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method || "PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status < 300
        ? resolve()
        : reject(new ApiError("The upload failed. Please try again.", xhr.status, "upload_failed"));
    xhr.onerror = () => reject(new ApiError("The upload was interrupted. Check your connection.", 0, "network"));
    xhr.send(file);
  });
}
