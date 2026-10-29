import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { request } from "../http";
import {
  type AnonymousComment,
  type AnonymousPost,
  type Community,
  type CursorPage,
  type MyCommunity,
  asPage,
  nextParam,
} from "../types";

export const communityKeys = {
  list: (q: string) => ["communities", q] as const,
  detail: (id: string) => ["community", id] as const,
  mine: ["myCommunities"] as const,
  gist: (communityId: string) => ["gist", communityId] as const,
  gistComments: (postId: string) => ["gistComments", postId] as const,
};

export function useCommunities(q = "") {
  return useQuery({
    queryKey: communityKeys.list(q),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<Community>(await unwrap(api.GET("/api/v1/communities/", { params: { query: { q: q || undefined } } }))),
  });
}

export function useCommunity(id: string | undefined) {
  return useQuery({
    queryKey: communityKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: () => unwrap(api.GET("/api/v1/communities/{community_id}/", { params: { path: { community_id: id! } } })),
  });
}

export function useMyCommunities(enabled = true) {
  return useQuery({
    queryKey: communityKeys.mine,
    enabled,
    queryFn: async () => asPage<MyCommunity>(await request("GET", "/api/v1/me/communities/")).results,
  });
}

export function useJoinCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, member }: { id: string; member: boolean }) =>
      member
        ? unwrap(api.POST("/api/v1/communities/{community_id}/leave/", { params: { path: { community_id: id } } }))
        : unwrap(api.POST("/api/v1/communities/{community_id}/join/", { params: { path: { community_id: id } } })),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: communityKeys.mine });
      void queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
  });
}

export function useCreateCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; privacy?: "public" | "restricted" | "private" }) =>
      unwrap(api.POST("/api/v1/communities/", { body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["communities"] });
      void queryClient.invalidateQueries({ queryKey: communityKeys.mine });
    },
  });
}

// ------------------------------------------------------------------ anonymous gist
export function useGist(communityId: string | undefined) {
  return useInfiniteQuery({
    queryKey: communityKeys.gist(communityId ?? ""),
    enabled: Boolean(communityId),
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      request<CursorPage<AnonymousPost>>("GET", "/api/v1/anonymous/posts/", {
        query: { audience_type: "community", audience_id: communityId, cursor: pageParam || undefined },
      }),
    getNextPageParam: (last) => nextParam(last.next, "cursor"),
  });
}

export function usePostGist(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      request<AnonymousPost>("POST", "/api/v1/anonymous/posts/", {
        body: { body, visibility: "community", audience_id: communityId },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communityKeys.gist(communityId) }),
  });
}

export function useDeleteGist(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => request("DELETE", `/api/v1/anonymous/posts/${postId}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communityKeys.gist(communityId) }),
  });
}

export function useGistReaction(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (post: AnonymousPost) =>
      post.viewer.reaction
        ? request("DELETE", `/api/v1/anonymous/posts/${post.id}/reaction/`)
        : request("POST", `/api/v1/anonymous/posts/${post.id}/reaction/`, { body: { kind: "like" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communityKeys.gist(communityId) }),
  });
}

export function useGistComments(postId: string | undefined) {
  return useQuery({
    queryKey: communityKeys.gistComments(postId ?? ""),
    enabled: Boolean(postId),
    queryFn: async () =>
      asPage<AnonymousComment>(await request("GET", `/api/v1/anonymous/posts/${postId}/comments/`)).results,
  });
}

export function useAddGistComment(postId: string, communityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => request("POST", `/api/v1/anonymous/posts/${postId}/comments/`, { body: { body } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.gistComments(postId) });
      void queryClient.invalidateQueries({ queryKey: communityKeys.gist(communityId) });
    },
  });
}
