import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { request } from "../http";
import { type Community, type MyCommunity, asPage } from "../types";

export const communityKeys = {
  list: (q: string) => ["communities", q] as const,
  detail: (id: string) => ["community", id] as const,
  mine: ["myCommunities"] as const,
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
    mutationFn: (body: {
      name: string;
      description?: string;
      privacy?: "public" | "restricted" | "private";
      parent_type?: string;
      parent_id?: string;
      requires_scope_membership?: boolean;
    }) => unwrap(api.POST("/api/v1/communities/", { body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["communities"] });
      void queryClient.invalidateQueries({ queryKey: communityKeys.mine });
    },
  });
}
