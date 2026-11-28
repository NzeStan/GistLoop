/** Creators: profiles, linked accounts, verification, media kits, sponsorship campaigns. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { ApiError } from "../errors";
import type { components } from "../schema";
import { asPage } from "../types";

type S = components["schemas"];
export type CreatorProfile = S["CreatorProfile"];
export type OwnCreatorProfile = S["CreatorOwnProfile"];
export type LinkedAccount = S["CreatorOwnLinkedAccount"];
export type MediaKit = S["CreatorOwnMediaKit"];
export type PublicMediaKit = S["CreatorMediaKit"];
export type CreatorVerification = S["CreatorVerificationRequest"];
export type Sponsorship = S["CreatorCampaign"];
export type SponsorshipWrite = S["CreatorCampaignWriteRequest"];
export type Participation = S["CreatorParticipation"];
export type Deliverable = S["CreatorDeliverable"];

function useCreatorMutation<A, R>(fn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ["creator", "creators", "sponsorships", "participations", "deliverables"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

const notFoundAsNull = async <T>(call: Promise<T>): Promise<T | null> => {
  try {
    return await call;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
};

// ---------------------------------------------------------------- reference
export function useCreatorCategories() {
  return useQuery({
    queryKey: ["creator", "categories"],
    staleTime: Infinity,
    queryFn: async () => asPage<S["CreatorCategory"]>(await unwrap(api.GET("/api/v1/creator-categories/"))).results,
  });
}

export function useCreatorProviders() {
  return useQuery({
    queryKey: ["creator", "providers"],
    staleTime: Infinity,
    queryFn: async () => asPage<S["CreatorProvider"]>(await unwrap(api.GET("/api/v1/creator-providers/"))).results,
  });
}

// ---------------------------------------------------------------- your profile
export function useMyCreatorProfile(enabled = true) {
  return useQuery({
    queryKey: ["creator", "me"],
    enabled,
    retry: false,
    queryFn: () => notFoundAsNull(unwrap(api.GET("/api/v1/me/creator/"))),
  });
}

export const useSaveCreatorProfile = (exists: boolean) =>
  useCreatorMutation((body: S["CreatorProfileWriteRequest"]) =>
    exists ? unwrap(api.PATCH("/api/v1/me/creator/", { body })) : unwrap(api.POST("/api/v1/me/creator/", { body })),
  );

export function useMyLinkedAccounts(enabled = true) {
  return useQuery({
    queryKey: ["creator", "accounts"],
    enabled,
    queryFn: async () => asPage<LinkedAccount>(await unwrap(api.GET("/api/v1/me/creator/linked-accounts/"))).results,
  });
}

export const useLinkAccount = () =>
  useCreatorMutation((body: S["CreatorLinkAccountRequest"]) =>
    unwrap(api.POST("/api/v1/me/creator/linked-accounts/", { body })),
  );

export const useUpdateLinkedAccount = () =>
  useCreatorMutation(({ id, body }: { id: string; body: S["PatchedCreatorAccountUpdateRequest"] }) =>
    unwrap(
      api.PATCH("/api/v1/me/creator/linked-accounts/{account_id}/", { params: { path: { account_id: id } }, body }),
    ),
  );

export const useRemoveLinkedAccount = () =>
  useCreatorMutation((id: string) =>
    unwrap(api.DELETE("/api/v1/me/creator/linked-accounts/{account_id}/", { params: { path: { account_id: id } } })),
  );

export const useVerifyLinkedAccount = () =>
  useCreatorMutation((id: string) =>
    unwrap(
      api.POST("/api/v1/me/creator/linked-accounts/{account_id}/verify/", { params: { path: { account_id: id } } }),
    ),
  );

export function useMyCreatorVerification(enabled = true) {
  return useQuery({
    queryKey: ["creator", "verification"],
    enabled,
    retry: false,
    queryFn: () => notFoundAsNull(unwrap(api.GET("/api/v1/me/creator/verification/"))),
  });
}

export const useRequestCreatorVerification = () =>
  useCreatorMutation((body: S["CreatorVerificationCreateRequest"]) =>
    unwrap(api.POST("/api/v1/me/creator/verification/", { body })),
  );

export const useWithdrawCreatorVerification = () =>
  useCreatorMutation(() => unwrap(api.DELETE("/api/v1/me/creator/verification/")));

export function useMyMediaKit(enabled = true) {
  return useQuery({
    queryKey: ["creator", "kit"],
    enabled,
    queryFn: () => unwrap(api.GET("/api/v1/me/creator/media-kit/")),
  });
}

export const useUpdateMediaKit = () =>
  useCreatorMutation((body: S["PatchedCreatorMediaKitWriteRequest"]) =>
    unwrap(api.PATCH("/api/v1/me/creator/media-kit/", { body })),
  );

export const useRotateMediaKitLink = () =>
  useCreatorMutation(() => unwrap(api.POST("/api/v1/me/creator/media-kit/rotate-link/")));

export function useMyParticipations(enabled = true) {
  return useQuery({
    queryKey: ["participations", "mine"],
    enabled,
    queryFn: async () => asPage<Participation>(await unwrap(api.GET("/api/v1/me/creator/campaigns/"))).results,
  });
}

// ---------------------------------------------------------------- public
export interface CreatorFilters {
  q?: string;
  category?: string;
  verified?: boolean;
  open?: boolean;
  min_reach?: number;
}

export function useCreators(filters: CreatorFilters) {
  return useQuery({
    queryKey: ["creators", filters],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<CreatorProfile>(
        await unwrap(
          api.GET("/api/v1/creators/", {
            params: {
              query: {
                q: filters.q || undefined,
                category: filters.category || undefined,
                verified: filters.verified ? "true" : undefined,
                open_to_sponsorships: filters.open ? "true" : undefined,
                min_reach: filters.min_reach ? String(filters.min_reach) : undefined,
              } as Record<string, string | undefined>,
            },
          }),
        ),
      ),
  });
}

export function useCreator(lookup: string | undefined) {
  return useQuery({
    queryKey: ["creators", "one", lookup],
    enabled: Boolean(lookup),
    retry: false,
    queryFn: () =>
      notFoundAsNull(unwrap(api.GET("/api/v1/creators/{lookup}/", { params: { path: { lookup: lookup! } } }))),
  });
}

export function useCreatorMediaKit(lookup: string | undefined, token?: string) {
  return useQuery({
    queryKey: ["creators", "kit", lookup, token],
    enabled: Boolean(lookup),
    retry: false,
    queryFn: () =>
      notFoundAsNull(
        unwrap(
          api.GET("/api/v1/creators/{lookup}/media-kit/", {
            params: { path: { lookup: lookup! }, query: { token: token || undefined } },
          }),
        ),
      ),
  });
}

// --------------------------------------------------------------- staff review
export function useCreatorVerificationQueue(status: string, enabled = true) {
  return useQuery({
    queryKey: ["creator", "queue", status],
    enabled,
    queryFn: async () =>
      asPage<CreatorVerification>(
        await unwrap(
          api.GET("/api/v1/creator/verification-requests/", { params: { query: { status: status || undefined } } }),
        ),
      ).results,
  });
}

export const useDecideCreatorVerification = () =>
  useCreatorMutation(({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) => {
    const args = { params: { path: { request_id: id } }, body: { reason: reason ?? "" } };
    return approve
      ? unwrap(api.POST("/api/v1/creator/verification-requests/{request_id}/approve/", args))
      : unwrap(api.POST("/api/v1/creator/verification-requests/{request_id}/reject/", args));
  });

/** Staff: linked accounts waiting for a manual ownership check. */
export function useAccountsToConfirm(enabled = true) {
  return useQuery({
    queryKey: ["creator", "accountsQueue"],
    enabled,
    queryFn: async () => asPage<LinkedAccount>(await unwrap(api.GET("/api/v1/creator/linked-accounts/"))).results,
  });
}

export const useConfirmAccount = () =>
  useCreatorMutation(({ id, followers }: { id: string; followers?: number }) =>
    unwrap(
      api.POST("/api/v1/creator/linked-accounts/{account_id}/confirm/", {
        params: { path: { account_id: id } },
        body: { follower_count: followers ?? null },
      }),
    ),
  );

export const useRevokeCreatorVerification = () =>
  useCreatorMutation(({ id, reason }: { id: string; reason: string }) =>
    unwrap(
      api.POST("/api/v1/creators/{profile_id}/revoke-verification/", {
        params: { path: { profile_id: id } },
        body: { reason },
      }),
    ),
  );

// -------------------------------------------------------------- sponsorships
export function useSponsorships(q: string, category: string) {
  return useQuery({
    queryKey: ["sponsorships", q, category],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<Sponsorship>(
        await unwrap(
          api.GET("/api/v1/campaigns/", { params: { query: { q: q || undefined, category: category || undefined } } }),
        ),
      ),
  });
}

export function useMySponsorships() {
  return useQuery({
    queryKey: ["sponsorships", "mine"],
    queryFn: async () => asPage<Sponsorship>(await unwrap(api.GET("/api/v1/me/campaigns/"))).results,
  });
}

export function useSponsorship(id: string | undefined) {
  return useQuery({
    queryKey: ["sponsorships", "one", id],
    enabled: Boolean(id),
    queryFn: () => unwrap(api.GET("/api/v1/campaigns/{campaign_id}/", { params: { path: { campaign_id: id! } } })),
  });
}

export const useSaveSponsorship = () =>
  useCreatorMutation(({ id, body }: { id?: string; body: SponsorshipWrite }) =>
    id
      ? unwrap(api.PATCH("/api/v1/campaigns/{campaign_id}/", { params: { path: { campaign_id: id } }, body }))
      : unwrap(api.POST("/api/v1/campaigns/", { body })),
  );

export type SponsorshipAction = "publish" | "close" | "complete" | "cancel";

export const useSponsorshipAction = (id: string) =>
  useCreatorMutation(({ action, reason }: { action: SponsorshipAction; reason?: string }) => {
    const args = { params: { path: { campaign_id: id } }, body: { reason: reason ?? "" } };
    switch (action) {
      case "publish":
        return unwrap(api.POST("/api/v1/campaigns/{campaign_id}/publish/", args));
      case "close":
        return unwrap(api.POST("/api/v1/campaigns/{campaign_id}/close/", args));
      case "complete":
        return unwrap(api.POST("/api/v1/campaigns/{campaign_id}/complete/", args));
      default:
        return unwrap(api.POST("/api/v1/campaigns/{campaign_id}/cancel/", args));
    }
  });

export const useApplyToSponsorship = (id: string) =>
  useCreatorMutation((body: S["CreatorApplyRequest"]) =>
    unwrap(api.POST("/api/v1/campaigns/{campaign_id}/apply/", { params: { path: { campaign_id: id } }, body })),
  );

export const useInviteCreator = (id: string) =>
  useCreatorMutation((body: S["CreatorInviteRequest"]) =>
    unwrap(api.POST("/api/v1/campaigns/{campaign_id}/invitations/", { params: { path: { campaign_id: id } }, body })),
  );

export function useParticipants(id: string | undefined, status: string, enabled = true) {
  return useQuery({
    queryKey: ["participations", id, status],
    enabled: enabled && Boolean(id),
    queryFn: async () =>
      asPage<Participation>(
        await unwrap(
          api.GET("/api/v1/campaigns/{campaign_id}/participations/", {
            params: { path: { campaign_id: id! }, query: { status: status || undefined } },
          }),
        ),
      ).results,
  });
}

export const useDecideParticipation = () =>
  useCreatorMutation(({ id, body }: { id: string; body: S["CreatorDecisionRequest"] }) =>
    unwrap(
      api.POST("/api/v1/participations/{participation_id}/decision/", {
        params: { path: { participation_id: id } },
        body,
      }),
    ),
  );

export function useDeliverables(participationId: string | undefined) {
  return useQuery({
    queryKey: ["deliverables", participationId],
    enabled: Boolean(participationId),
    queryFn: async () =>
      asPage<Deliverable>(
        await unwrap(
          api.GET("/api/v1/participations/{participation_id}/deliverables/", {
            params: { path: { participation_id: participationId! } },
          }),
        ),
      ).results,
  });
}

export const useAddDeliverable = (participationId: string) =>
  useCreatorMutation((body: S["CreatorDeliverableWriteRequest"]) =>
    unwrap(
      api.POST("/api/v1/participations/{participation_id}/deliverables/", {
        params: { path: { participation_id: participationId } },
        body,
      }),
    ),
  );

export const useSubmitDeliverable = () =>
  useCreatorMutation(({ id, body }: { id: string; body: S["CreatorSubmitRequest"] }) =>
    unwrap(
      api.POST("/api/v1/deliverables/{deliverable_id}/submit/", { params: { path: { deliverable_id: id } }, body }),
    ),
  );

export const useReviewDeliverable = () =>
  useCreatorMutation(({ id, body }: { id: string; body: S["CreatorReviewRequest"] }) =>
    unwrap(
      api.POST("/api/v1/deliverables/{deliverable_id}/review/", { params: { path: { deliverable_id: id } }, body }),
    ),
  );
