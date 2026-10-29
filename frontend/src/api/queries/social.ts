import { type InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { request } from "../http";
import { uploadFile } from "../upload";
import {
  type Comment,
  type CursorPage,
  type Hashtag,
  type OffsetPage,
  type Post,
  type PostMedia,
  type SocialVisibility,
  asPage,
  nextParam,
} from "../types";

export type FeedName = "home" | "explore" | "trending";
const TRENDING_PAGE = 20;

type FeedPage = CursorPage<Post> | OffsetPage<Post>;

export const socialKeys = {
  feed: (name: FeedName) => ["feed", name] as const,
  post: (id: string) => ["post", id] as const,
  comments: (postId: string) => ["comments", postId] as const,
  userPosts: (userId: string) => ["userPosts", userId] as const,
  audiencePosts: (type: string, id: string) => ["audiencePosts", type, id] as const,
  hashtag: (tag: string) => ["hashtag", tag] as const,
  hashtags: ["hashtags"] as const,
  bookmarks: ["bookmarks"] as const,
};

/** A cursor- or offset-paginated feed of posts, loaded page by page. */
export function useFeed(name: FeedName, enabled = true) {
  return useInfiniteQuery({
    queryKey: socialKeys.feed(name),
    enabled,
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      request<FeedPage>("GET", `/api/v1/social/feeds/${name}/`, {
        query:
          name === "trending" ? { offset: pageParam || 0, limit: TRENDING_PAGE } : { cursor: pageParam || undefined },
      }),
    getNextPageParam: (last: FeedPage) => {
      if ("offset" in last) {
        return last.results.length < last.limit ? undefined : String(last.offset + last.limit);
      }
      return nextParam(last.next, "cursor");
    },
  });
}

function usePostList(key: readonly unknown[], path: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: key,
    enabled,
    initialPageParam: "",
    queryFn: ({ pageParam }) => request<CursorPage<Post>>("GET", path, { query: { cursor: pageParam || undefined } }),
    getNextPageParam: (last) => nextParam(last.next, "cursor"),
  });
}

export const useUserPosts = (userId: string | undefined) =>
  usePostList(socialKeys.userPosts(userId ?? ""), `/api/v1/social/users/${userId}/posts/`, Boolean(userId));

export const useAudiencePosts = (type: string, id: string | undefined) =>
  usePostList(socialKeys.audiencePosts(type, id ?? ""), `/api/v1/social/audiences/${type}/${id}/posts/`, Boolean(id));

export const useHashtagPosts = (tag: string) =>
  usePostList(socialKeys.hashtag(tag), `/api/v1/social/hashtags/${encodeURIComponent(tag)}/posts/`, Boolean(tag));

export const useBookmarks = () => usePostList(socialKeys.bookmarks, "/api/v1/social/me/bookmarks/");

export function useHashtags() {
  return useQuery({
    queryKey: socialKeys.hashtags,
    queryFn: async () => asPage<Hashtag>(await request("GET", "/api/v1/social/hashtags/")).results,
    staleTime: 5 * 60_000,
  });
}

export function usePost(id: string | undefined) {
  return useQuery({
    queryKey: socialKeys.post(id ?? ""),
    enabled: Boolean(id),
    queryFn: () => request<Post>("GET", `/api/v1/social/posts/${id}/`),
  });
}

export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: socialKeys.comments(postId ?? ""),
    enabled: Boolean(postId),
    queryFn: async () =>
      asPage<Comment>(
        await unwrap(api.GET("/api/v1/social/posts/{post_id}/comments/", { params: { path: { post_id: postId! } } })),
      ).results,
  });
}

export interface NewPost {
  body: string;
  visibility: SocialVisibility;
  audience_id?: string;
  comments_enabled?: boolean;
  /** Ids of images uploaded with {@link useUploadMedia}. */
  media?: string[];
}

/** Update a post wherever it's cached (feeds, profile lists, the detail view). */
function patchPostEverywhere(queryClient: ReturnType<typeof useQueryClient>, id: string, patch: (p: Post) => Post) {
  queryClient.setQueriesData<InfiniteData<FeedPage>>({ predicate: isPostList }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            results: page.results.map((p) => (p.id === id ? patch(p) : p)),
          })),
        }
      : data,
  );
  queryClient.setQueryData<Post>(socialKeys.post(id), (post) => (post ? patch(post) : post));
}

const POST_LISTS = new Set(["feed", "userPosts", "audiencePosts", "hashtag", "bookmarks"]);
const isPostList = (query: { queryKey: readonly unknown[] }) => POST_LISTS.has(String(query.queryKey[0]));

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (post: NewPost) => request<Post>("POST", "/api/v1/social/posts/", { body: post }),
    onSuccess: () => queryClient.invalidateQueries({ predicate: isPostList }),
  });
}

/** Upload an image for a post (attach its id when posting). */
export function useUploadMedia() {
  return useMutation({
    mutationFn: (file: File) => uploadFile<PostMedia>("/api/v1/social/media/", file),
  });
}

export function useDeleteMedia() {
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/social/media/{media_id}/", { params: { path: { media_id: id } } })),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<void>("DELETE", `/api/v1/social/posts/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ predicate: isPostList }),
  });
}

/** Like / unlike with an optimistic update. */
export function useToggleReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ post, kind = "like" }: { post: Post; kind?: string }) =>
      post.viewer.reaction
        ? request("DELETE", `/api/v1/social/posts/${post.id}/reaction/`)
        : request("POST", `/api/v1/social/posts/${post.id}/reaction/`, { body: { kind } }),
    onMutate: ({ post, kind = "like" }) => {
      const reacted = Boolean(post.viewer.reaction);
      patchPostEverywhere(queryClient, post.id, (p) => ({
        ...p,
        viewer: { ...p.viewer, reaction: reacted ? null : kind },
        counts: { ...p.counts, reactions: Math.max(0, p.counts.reactions + (reacted ? -1 : 1)) },
      }));
      return { post };
    },
    onError: (_error, _vars, context) => {
      if (context) patchPostEverywhere(queryClient, context.post.id, () => context.post);
    },
  });
}

export function useToggleBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (post: Post) =>
      request(post.viewer.bookmarked ? "DELETE" : "POST", `/api/v1/social/posts/${post.id}/bookmark/`),
    onMutate: (post) => {
      patchPostEverywhere(queryClient, post.id, (p) => ({
        ...p,
        viewer: { ...p.viewer, bookmarked: !p.viewer.bookmarked },
      }));
      return { post };
    },
    onError: (_error, _post, context) => {
      if (context) patchPostEverywhere(queryClient, context.post.id, () => context.post);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: socialKeys.bookmarks }),
  });
}

export function useToggleRepost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (post: Post) =>
      request(post.viewer.reposted ? "DELETE" : "POST", `/api/v1/social/posts/${post.id}/repost/`, {
        body: post.viewer.reposted ? undefined : {},
      }),
    onSuccess: () => queryClient.invalidateQueries({ predicate: isPostList }),
  });
}

export function useAddComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      unwrap(
        api.POST("/api/v1/social/posts/{post_id}/comments/", {
          params: { path: { post_id: postId } },
          body: { body },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: socialKeys.comments(postId) });
      patchPostEverywhere(queryClient, postId, (p) => ({
        ...p,
        counts: { ...p.counts, comments: p.counts.comments + 1 },
      }));
    },
  });
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      unwrap(api.DELETE("/api/v1/social/comments/{comment_id}/", { params: { path: { comment_id: commentId } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: socialKeys.comments(postId) }),
  });
}

export function useVote(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: string[]) =>
      request<Post>("POST", `/api/v1/social/posts/${postId}/poll/vote/`, { body: { options } }),
    onSuccess: () => queryClient.invalidateQueries({ predicate: isPostList }),
  });
}

export function useFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, following }: { userId: string; following: boolean }) =>
      following
        ? unwrap(api.DELETE("/api/v1/social/users/{user_id}/follow/", { params: { path: { user_id: userId } } }))
        : unwrap(api.POST("/api/v1/social/users/{user_id}/follow/", { params: { path: { user_id: userId } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: socialKeys.feed("home") });
    },
  });
}

export interface ReportReason {
  key: string;
  label: string;
  description?: string;
}

export function useReportReasons(enabled: boolean) {
  return useQuery({
    queryKey: ["reportReasons"],
    enabled,
    staleTime: 60 * 60_000,
    queryFn: async () => asPage<ReportReason>(await request("GET", "/api/v1/moderation/reasons/")).results,
  });
}

export function useReport() {
  return useMutation({
    mutationFn: (report: { content_type: string; object_id: string; reason: string; details?: string }) =>
      request("POST", "/api/v1/moderation/reports/", { body: report }),
  });
}
