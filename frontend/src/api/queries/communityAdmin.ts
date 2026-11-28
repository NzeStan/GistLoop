/** Running a community: members, requests, bans, roles, invitations, invite links, settings. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import type { components } from "../schema";
import { asPage } from "../types";

type S = components["schemas"];
export type CommunityMember = S["CommunityMember"];
export type CommunityMembership = S["CommunityMembership"];
export type CommunityRole = S["CommunityRoleEnum"];
export type InviteLink = S["CommunityInviteLink"];
export type CommunityUpdate = S["PatchedCommunityUpdateRequest"];

const keys = {
  list: (id: string, which: string) => ["communityAdmin", id, which] as const,
  invitations: ["communityInvitations"] as const,
};

function useAdminMutation<A, R>(fn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ["communityAdmin", "community", "communities", "myCommunities", "communityInvitations"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useCommunityPeople(id: string | undefined, which: "members" | "requests" | "bans", role?: string) {
  return useQuery({
    queryKey: [...keys.list(id ?? "", which), role ?? ""],
    enabled: Boolean(id),
    queryFn: async () => {
      const path = { params: { path: { community_id: id! } } };
      const call =
        which === "members"
          ? api.GET("/api/v1/communities/{community_id}/members/", {
              params: { path: { community_id: id! }, query: { role: role || undefined } },
            })
          : which === "requests"
            ? api.GET("/api/v1/communities/{community_id}/requests/", path)
            : api.GET("/api/v1/communities/{community_id}/bans/", path);
      return asPage<CommunityMember>(await unwrap(call as Promise<{ data?: unknown; response: Response }>)).results;
    },
  });
}

export type MemberAction = "approve" | "decline" | "remove" | "ban" | "unban";

export const useMemberAction = (id: string) =>
  useAdminMutation(({ userId, action, reason }: { userId: string; action: MemberAction; reason?: string }) => {
    const args = { params: { path: { community_id: id, user_id: userId } }, body: { reason: reason ?? "" } };
    switch (action) {
      case "approve":
        return unwrap(api.POST("/api/v1/communities/{community_id}/members/{user_id}/approve/", args));
      case "decline":
        return unwrap(api.POST("/api/v1/communities/{community_id}/members/{user_id}/decline/", args));
      case "ban":
        return unwrap(api.POST("/api/v1/communities/{community_id}/members/{user_id}/ban/", args));
      case "unban":
        return unwrap(api.POST("/api/v1/communities/{community_id}/members/{user_id}/unban/", args));
      default:
        return unwrap(api.POST("/api/v1/communities/{community_id}/members/{user_id}/remove/", args));
    }
  });

export const useSetMemberRole = (id: string) =>
  useAdminMutation(({ userId, role }: { userId: string; role: "admin" | "moderator" | "member" }) =>
    unwrap(
      api.PATCH("/api/v1/communities/{community_id}/members/{user_id}/", {
        params: { path: { community_id: id, user_id: userId } },
        body: { role },
      }),
    ),
  );

export const useInviteToCommunity = (id: string) =>
  useAdminMutation((userId: string) =>
    unwrap(
      api.POST("/api/v1/communities/{community_id}/invitations/", {
        params: { path: { community_id: id } },
        body: { user_id: userId },
      }),
    ),
  );

export const useCreateInviteLink = (id: string) =>
  useAdminMutation((body: S["CommunityInviteLinkCreateRequest"]) =>
    unwrap(
      api.POST("/api/v1/communities/{community_id}/invite-links/", { params: { path: { community_id: id } }, body }),
    ),
  );

export const useRevokeInviteLink = (id: string) =>
  useAdminMutation((linkId: string) =>
    unwrap(
      api.DELETE("/api/v1/communities/{community_id}/invite-links/{link_id}/", {
        params: { path: { community_id: id, link_id: linkId } },
      }),
    ),
  );

export const useTransferCommunity = (id: string) =>
  useAdminMutation((userId: string) =>
    unwrap(
      api.POST("/api/v1/communities/{community_id}/transfer-ownership/", {
        params: { path: { community_id: id } },
        body: { user_id: userId },
      }),
    ),
  );

export const useUpdateCommunity = (id: string) =>
  useAdminMutation((body: CommunityUpdate) =>
    unwrap(api.PATCH("/api/v1/communities/{community_id}/", { params: { path: { community_id: id } }, body })),
  );

export const useDeleteCommunity = () =>
  useAdminMutation((id: string) =>
    unwrap(api.DELETE("/api/v1/communities/{community_id}/", { params: { path: { community_id: id } } })),
  );

/** GistLoop staff: mark a community as official. */
export const useSetOfficial = (id: string) =>
  useAdminMutation((official: boolean) =>
    unwrap(
      api.POST("/api/v1/communities/{community_id}/official/", {
        params: { path: { community_id: id } },
        body: { official },
      }),
    ),
  );

// ------------------------------------------------------------- your invitations
export function useMyCommunityInvitations(enabled = true) {
  return useQuery({
    queryKey: keys.invitations,
    enabled,
    queryFn: async () =>
      asPage<CommunityMembership>(await unwrap(api.GET("/api/v1/me/community-invitations/"))).results,
  });
}

export const useAnswerInvitation = () =>
  useAdminMutation(({ id, accept }: { id: string; accept: boolean }) =>
    accept
      ? unwrap(
          api.POST("/api/v1/communities/{community_id}/invitations/accept/", {
            params: { path: { community_id: id } },
          }),
        )
      : unwrap(
          api.POST("/api/v1/communities/{community_id}/invitations/decline/", {
            params: { path: { community_id: id } },
          }),
        ),
  );

export const useJoinWithCode = () =>
  useAdminMutation((code: string) => unwrap(api.POST("/api/v1/communities/join-with-code/", { body: { code } })));
