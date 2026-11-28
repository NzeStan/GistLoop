/** Anonymous gist: boards for communities, institutions and campuses. */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { request } from "../http";
import { type AnonymousComment, type AnonymousPost, type CursorPage, asPage, nextParam } from "../types";

export type GistAudienceType = "community" | "institution" | "campus";
export interface GistAudience {
  type: GistAudienceType;
  id: string;
}

export const gistKeys = {
  all: ["gist"] as const,
  board: (a: GistAudience) => ["gist", a.type, a.id] as const,
  comments: (postId: string) => ["gistComments", postId] as const,
  shareStatus: (ids: string[]) => ["gistShare", ...ids] as const,
};

export function useGist(audience: GistAudience | undefined) {
  return useInfiniteQuery({
    queryKey: audience ? gistKeys.board(audience) : ["gist", "none"],
    enabled: Boolean(audience?.id),
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      request<CursorPage<AnonymousPost>>("GET", "/api/v1/anonymous/posts/", {
        query: { audience_type: audience!.type, audience_id: audience!.id, cursor: pageParam || undefined },
      }),
    getNextPageParam: (last) => nextParam(last.next, "cursor"),
  });
}

export function usePostGist(audience: GistAudience) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, shareToSocials }: { body: string; shareToSocials: boolean }) => {
      const post = await request<AnonymousPost>("POST", "/api/v1/anonymous/posts/", {
        body: { body, visibility: audience.type, audience_id: audience.id },
      });
      // Opting in only asks: an editor reviews it before anything is posted.
      if (shareToSocials) {
        await unwrap(
          api.POST("/api/v1/syndication/anonymous/{post_id}/share/", { params: { path: { post_id: post.id } } }),
        ).catch(() => undefined);
      }
      return post;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gistKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["gistShare"] });
    },
  });
}

function useGistMutation<T>(fn: (arg: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gistKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["gistPost"] });
    },
  });
}

export const useDeleteGist = () =>
  useGistMutation((postId: string) => request("DELETE", `/api/v1/anonymous/posts/${postId}/`));

export const useGistReaction = () =>
  useGistMutation((post: AnonymousPost) =>
    post.viewer.reaction
      ? request("DELETE", `/api/v1/anonymous/posts/${post.id}/reaction/`)
      : request("POST", `/api/v1/anonymous/posts/${post.id}/reaction/`, { body: { kind: "like" } }),
  );

/** Hide a post from your own view of the board (or bring it back). */
export const useHideGist = () =>
  useGistMutation(({ postId, hidden }: { postId: string; hidden: boolean }) =>
    request(hidden ? "DELETE" : "POST", `/api/v1/anonymous/posts/${postId}/hide/`),
  );

export function useGistComments(postId: string | undefined) {
  return useQuery({
    queryKey: gistKeys.comments(postId ?? ""),
    enabled: Boolean(postId),
    queryFn: async () =>
      asPage<AnonymousComment>(await request("GET", `/api/v1/anonymous/posts/${postId}/comments/`)).results,
  });
}

export function useAddGistComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => request("POST", `/api/v1/anonymous/posts/${postId}/comments/`, { body: { body } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gistKeys.comments(postId) });
      void queryClient.invalidateQueries({ queryKey: gistKeys.all });
    },
  });
}

export function useDeleteGistComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => request("DELETE", `/api/v1/anonymous/comments/${commentId}/`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gistKeys.comments(postId) });
      void queryClient.invalidateQueries({ queryKey: gistKeys.all });
    },
  });
}

// --------------------------------------------------- sharing to GistLoop's social pages
export type ShareStatus = "pending_review" | "approved" | "sent" | "rejected" | "taken_down";

/** Share status of your own posts (the API only ever reports the viewer's own). */
export function useGistShareStatus(postIds: string[]) {
  return useQuery({
    queryKey: gistKeys.shareStatus(postIds),
    enabled: postIds.length > 0,
    queryFn: async () =>
      (
        await unwrap(
          api.GET("/api/v1/syndication/anonymous/share-status/", { params: { query: { ids: postIds.join(",") } } }),
        )
      ).statuses as Record<string, ShareStatus>,
  });
}

export function useShareGistToSocials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, share }: { postId: string; share: boolean }) =>
      share
        ? unwrap(api.POST("/api/v1/syndication/anonymous/{post_id}/share/", { params: { path: { post_id: postId } } }))
        : unwrap(
            api.DELETE("/api/v1/syndication/anonymous/{post_id}/share/", { params: { path: { post_id: postId } } }),
          ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gistShare"] }),
  });
}
