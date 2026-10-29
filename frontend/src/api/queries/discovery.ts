import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { request } from "../http";
import {
  type CursorPage,
  type Notification,
  type SearchPerson,
  type SearchResult,
  type TrendingItem,
  nextParam,
} from "../types";

// ------------------------------------------------------------------ trending & search
export function useTrending(type?: string, limit = 10) {
  return useQuery({
    queryKey: ["trending", type ?? "all", limit],
    staleTime: 2 * 60_000,
    queryFn: () =>
      unwrap(api.GET("/api/v1/trending/", { params: { query: { type, limit } } })) as Promise<TrendingItem[]>,
  });
}

export function useSearch(q: string, types?: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ["search", query, types ?? ""],
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
    queryFn: () =>
      unwrap(api.GET("/api/v1/search/", { params: { query: { q: query, types, limit: 30 } } })) as Promise<
        SearchResult[]
      >,
  });
}

export function usePeopleSearch(q: string, enabled = true) {
  const query = q.trim();
  return useQuery({
    queryKey: ["people", query],
    enabled: enabled && query.length >= 3 && !query.includes("@"),
    placeholderData: keepPreviousData,
    queryFn: () =>
      unwrap(api.GET("/api/v1/search/people/", { params: { query: { q: query } } })) as Promise<SearchPerson[]>,
  });
}

// ------------------------------------------------------------------ notifications
export const notificationKeys = {
  list: (unread: boolean) => ["notifications", unread] as const,
  counts: ["notificationCounts"] as const,
};

export function useNotifications(unreadOnly = false) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(unreadOnly),
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      request<CursorPage<Notification>>("GET", "/api/v1/notifications/", {
        query: { unread: unreadOnly || undefined, cursor: pageParam || undefined },
      }),
    getNextPageParam: (last) => nextParam(last.next, "cursor"),
  });
}

export function useNotificationCounts(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.counts,
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: () => unwrap(api.GET("/api/v1/notifications/counts/")),
  });
}

export function useNotification(id: string | undefined) {
  return useQuery({
    queryKey: ["notification", id],
    enabled: Boolean(id),
    queryFn: () =>
      unwrap(api.GET("/api/v1/notifications/{notification_id}/", { params: { path: { notification_id: id! } } })),
  });
}

export function useMarkNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      read
        ? unwrap(
            api.POST("/api/v1/notifications/{notification_id}/read/", {
              params: { path: { notification_id: id } },
            }),
          )
        : unwrap(
            api.POST("/api/v1/notifications/{notification_id}/unread/", {
              params: { path: { notification_id: id } },
            }),
          ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.counts });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/notifications/read-all/")),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.counts });
    },
  });
}

export function useMarkSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/notifications/seen/")),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.counts }),
  });
}
