import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { request } from "../http";
import type { components } from "../schema";
import { asPage } from "../types";
import { uploadFile } from "../upload";

type S = components["schemas"];

export type Campaign = S["PromotionCampaign"];
export type PromotedItem = S["PromotedItem"];
export type Placement = "feed" | "events" | "marketplace" | "opportunities";

// ------------------------------------------------------------------ sponsored items (viewers)
/**
 * Sponsored items for a placement. Ads are optional extras: if the API has nothing (or fails),
 * pages simply show none. Premium members with the ad-free perk get an empty list from the API.
 */
export function useSponsored(placement: Placement) {
  return useQuery({
    queryKey: ["sponsored", placement],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () => unwrap(api.GET("/api/v1/promotions/serve/", { params: { query: { placement } } })),
  });
}

/** Count an impression once the item has actually been seen. Failures don't matter to the viewer. */
export function recordImpression(token: string): void {
  void request("POST", "/api/v1/promotions/impressions/", { body: { token } }).catch(() => undefined);
}

/** Count the click; the answer says where the item leads. */
export function recordClick(token: string) {
  return unwrap(api.POST("/api/v1/promotions/clicks/", { body: { token } }));
}

// ------------------------------------------------------------------ campaigns (advertisers)
export const promotionKeys = {
  options: ["promotionOptions"] as const,
  campaigns: ["campaigns"] as const,
  campaign: (id: string) => ["campaign", id] as const,
  stats: (id: string) => ["campaignStats", id] as const,
};

export function usePromotionOptions() {
  return useQuery({
    queryKey: promotionKeys.options,
    staleTime: 60 * 60_000,
    queryFn: () => unwrap(api.GET("/api/v1/promotions/options/")),
  });
}

export function useCampaigns() {
  return useQuery({
    queryKey: promotionKeys.campaigns,
    queryFn: async () => asPage<Campaign>(await unwrap(api.GET("/api/v1/promotions/campaigns/"))),
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: promotionKeys.campaign(id ?? ""),
    enabled: Boolean(id),
    queryFn: () =>
      unwrap(api.GET("/api/v1/promotions/campaigns/{campaign_id}/", { params: { path: { campaign_id: id! } } })),
  });
}

export function useCampaignStats(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: promotionKeys.stats(id ?? ""),
    enabled: Boolean(id) && enabled,
    queryFn: () =>
      unwrap(api.GET("/api/v1/promotions/campaigns/{campaign_id}/stats/", { params: { path: { campaign_id: id! } } })),
  });
}

function useCampaignSaved() {
  const queryClient = useQueryClient();
  return (campaign: Campaign) => {
    queryClient.setQueryData(promotionKeys.campaign(campaign.id), campaign);
    void queryClient.invalidateQueries({ queryKey: promotionKeys.campaigns });
  };
}

export function useCreateCampaign() {
  const saved = useCampaignSaved();
  return useMutation({
    mutationFn: (body: S["PromotionCampaignWriteRequest"]) =>
      unwrap(api.POST("/api/v1/promotions/campaigns/", { body })),
    onSuccess: saved,
  });
}

export function useCampaignImage() {
  const saved = useCampaignSaved();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      uploadFile<Campaign>(`/api/v1/promotions/campaigns/${id}/image/`, file),
    onSuccess: saved,
  });
}

export function useCampaignAction() {
  const saved = useCampaignSaved();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "submit" | "pause" | "resume" }) => {
      const params = { path: { campaign_id: id } };
      switch (action) {
        case "submit":
          return unwrap(api.POST("/api/v1/promotions/campaigns/{campaign_id}/submit/", { params }));
        case "pause":
          return unwrap(api.POST("/api/v1/promotions/campaigns/{campaign_id}/pause/", { params }));
        case "resume":
          return unwrap(api.POST("/api/v1/promotions/campaigns/{campaign_id}/resume/", { params }));
      }
    },
    onSuccess: saved,
  });
}

// ------------------------------------------------------------------ premium plans
export const subscriptionKeys = { plans: ["plans"] as const, mine: ["mySubscription"] as const };

export function usePlans() {
  return useQuery({
    queryKey: subscriptionKeys.plans,
    staleTime: 60 * 60_000,
    queryFn: () => unwrap(api.GET("/api/v1/subscriptions/plans/")),
  });
}

export function useMySubscription(enabled = true) {
  return useQuery({
    queryKey: subscriptionKeys.mine,
    enabled,
    queryFn: () => unwrap(api.GET("/api/v1/subscriptions/me/")),
  });
}

export function useSubscribe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: S["SubscribeRequest"]) => unwrap(api.POST("/api/v1/subscriptions/me/", { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: subscriptionKeys.mine }),
  });
}

/** Turn renewal off (keeps the perks until the period ends) or back on. */
export function useSetCancelAtPeriodEnd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cancel: boolean) => unwrap(api.POST("/api/v1/subscriptions/me/cancel/", { body: { cancel } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: subscriptionKeys.mine }),
  });
}

/** Drop a subscription that was never paid for. */
export function useAbandonSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.DELETE("/api/v1/subscriptions/me/")),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: subscriptionKeys.mine }),
  });
}
