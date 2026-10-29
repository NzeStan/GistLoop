import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import type { components } from "../schema";
import { type Listing, type MarketCategory, type MarketOrder, asPage } from "../types";
import { uploadFile } from "../upload";

type S = components["schemas"];

export interface ListingFilters {
  q?: string;
  category?: string;
  condition?: "new" | "like_new" | "used" | "for_parts" | "not_applicable";
  sort?: string;
}

export const marketKeys = {
  list: (filters: ListingFilters) => ["listings", filters] as const,
  detail: (id: string) => ["listing", id] as const,
  categories: ["marketCategories"] as const,
};

export function useListings(filters: ListingFilters = {}) {
  return useQuery({
    queryKey: marketKeys.list(filters),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<Listing>(
        await unwrap(
          api.GET("/api/v1/marketplace/listings/", {
            params: {
              query: {
                q: filters.q || undefined,
                category: filters.category || undefined,
                condition: filters.condition,
                sort: filters.sort || undefined,
              },
            },
          }),
        ),
      ),
  });
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: marketKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: () =>
      unwrap(api.GET("/api/v1/marketplace/listings/{listing_id}/", { params: { path: { listing_id: id! } } })),
  });
}

export function useMarketCategories() {
  return useQuery({
    queryKey: marketKeys.categories,
    staleTime: 60 * 60_000,
    queryFn: async () => asPage<MarketCategory>(await unwrap(api.GET("/api/v1/marketplace/categories/"))).results,
  });
}

// ------------------------------------------------------------------ selling
export const sellKeys = {
  myListings: ["myListings"] as const,
  orders: (role: "buyer" | "seller") => ["marketOrders", role] as const,
};

export function useCreateListing() {
  return useMutation({
    mutationFn: (body: S["MarketListingWriteRequest"]) => unwrap(api.POST("/api/v1/marketplace/listings/", { body })),
  });
}

export function useUploadListingImage() {
  return useMutation({
    mutationFn: ({ listingId, file }: { listingId: string; file: File }) =>
      uploadFile<S["MarketImage"]>(`/api/v1/marketplace/listings/${listingId}/images/`, file),
  });
}

export function useListingAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, action }: { listingId: string; action: S["MarketListingActionActionEnum"] }) =>
      unwrap(
        api.POST("/api/v1/marketplace/listings/{listing_id}/status/", {
          params: { path: { listing_id: listingId } },
          body: { action },
        }),
      ),
    onSuccess: (listing) => {
      queryClient.setQueryData(marketKeys.detail(listing.id), listing);
      void queryClient.invalidateQueries({ queryKey: sellKeys.myListings });
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}

export function useMyListings() {
  return useQuery({
    queryKey: sellKeys.myListings,
    queryFn: async () => asPage<Listing>(await unwrap(api.GET("/api/v1/marketplace/me/listings/"))),
  });
}

// ------------------------------------------------------------------ buying
export function usePlaceOrder() {
  return useMutation({
    mutationFn: (body: S["MarketOrderCreateRequest"]) =>
      unwrap(
        api.POST("/api/v1/marketplace/orders/", {
          params: { header: { "Idempotency-Key": crypto.randomUUID() } },
          body,
        }),
      ),
  });
}

export function useMyOrders(role: "buyer" | "seller") {
  return useQuery({
    queryKey: sellKeys.orders(role),
    queryFn: async () =>
      asPage<MarketOrder>(await unwrap(api.GET("/api/v1/marketplace/me/orders/", { params: { query: { role } } }))),
  });
}

export type OrderAction = "cancel" | "confirm" | "fulfil" | "complete";

export function useOrderAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, action }: { orderId: string; action: OrderAction }) => {
      const params = { path: { order_id: orderId } };
      switch (action) {
        case "cancel":
          return unwrap(api.POST("/api/v1/marketplace/orders/{order_id}/cancel/", { params, body: { reason: "" } }));
        case "confirm":
          return unwrap(api.POST("/api/v1/marketplace/orders/{order_id}/confirm/", { params }));
        case "fulfil":
          return unwrap(api.POST("/api/v1/marketplace/orders/{order_id}/fulfil/", { params }));
        case "complete":
          return unwrap(api.POST("/api/v1/marketplace/orders/{order_id}/complete/", { params }));
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["marketOrders"] }),
  });
}
