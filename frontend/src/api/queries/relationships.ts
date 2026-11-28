/** Followers, follow requests, and blocking, muting and restricting people. */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { request } from "../http";
import type { components } from "../schema";
import { type Page, type UserSummary, asPage, nextParam } from "../types";

type FollowRequest = components["schemas"]["Follow"] & {
  user: { id: string; handle: string | null; display_name: string; avatar_url: string | null };
};
export type { FollowRequest };

export type Relation = "block" | "mute" | "restrict";
const LIST: Record<Relation, string> = {
  block: "/api/v1/social/me/blocks/",
  mute: "/api/v1/social/me/mutes/",
  restrict: "/api/v1/social/me/restrictions/",
};

export const relationKeys = {
  list: (relation: Relation) => ["relations", relation] as const,
  people: (userId: string, which: string) => ["followPeople", userId, which] as const,
  followRequests: ["followRequests"] as const,
};

/** Everyone you've blocked, muted or restricted. */
export function useRelationList(relation: Relation, enabled = true) {
  return useQuery({
    queryKey: relationKeys.list(relation),
    enabled,
    queryFn: async () =>
      asPage<UserSummary>(await request("GET", LIST[relation], { query: { page_size: 200 } })).results,
  });
}

export function useSetRelation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, relation, on }: { userId: string; relation: Relation; on: boolean }) =>
      request(on ? "POST" : "DELETE", `/api/v1/social/users/${userId}/${relation}/`),
    onSuccess: (_d, { relation }) => {
      void queryClient.invalidateQueries({ queryKey: relationKeys.list(relation) });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

/** Someone's followers or the people they follow. */
export function usePeople(userId: string | undefined, which: "followers" | "following") {
  return useInfiniteQuery({
    queryKey: relationKeys.people(userId ?? "", which),
    enabled: Boolean(userId),
    initialPageParam: "",
    queryFn: async ({ pageParam }) =>
      asPage<UserSummary>(
        await request<Page<UserSummary>>("GET", `/api/v1/social/users/${userId}/${which}/`, {
          query: { page: pageParam || undefined },
        }),
      ),
    getNextPageParam: (last) => nextParam(last.next, "page"),
  });
}

export function useRemoveFollower() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(api.DELETE("/api/v1/social/me/followers/{user_id}/", { params: { path: { user_id: userId } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["followPeople"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/** People asking to follow your private account. */
export function useFollowRequests(enabled = true) {
  return useQuery({
    queryKey: relationKeys.followRequests,
    enabled,
    queryFn: async () => asPage<FollowRequest>(await unwrap(api.GET("/api/v1/social/me/follow-requests/"))).results,
  });
}

export function useAnswerFollowRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ followId, approve }: { followId: string; approve: boolean }) =>
      approve
        ? unwrap(
            api.POST("/api/v1/social/me/follow-requests/{follow_id}/approve/", {
              params: { path: { follow_id: followId } },
            }),
          )
        : unwrap(
            api.POST("/api/v1/social/me/follow-requests/{follow_id}/decline/", {
              params: { path: { follow_id: followId } },
            }),
          ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: relationKeys.followRequests });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// ------------------------------------------------------ moderators: hide / restore
export function useModerateContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kind,
      id,
      action,
      reason,
    }: {
      kind: "posts" | "comments";
      id: string;
      action: "hide" | "restore";
      reason?: string;
    }) => request("POST", `/api/v1/social/${kind}/${id}/${action}/`, { body: { reason: reason ?? "" } }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        predicate: (q) =>
          ["feed", "post", "comments", "userPosts", "audiencePosts", "hashtag", "bookmarks"].includes(
            String(q.queryKey[0]),
          ),
      }),
  });
}

/** Like or unlike a comment. */
export function useCommentReaction(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, liked }: { commentId: string; liked: boolean }) =>
      liked
        ? unwrap(
            api.DELETE("/api/v1/social/comments/{comment_id}/reaction/", {
              params: { path: { comment_id: commentId } },
            }),
          )
        : unwrap(
            api.POST("/api/v1/social/comments/{comment_id}/reaction/", {
              params: { path: { comment_id: commentId } },
              body: { kind: "like" },
            }),
          ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comments", postId] }),
  });
}
