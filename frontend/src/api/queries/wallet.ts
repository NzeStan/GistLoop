/** Money: your payments and refunds, seller balance and payouts; shops, order details, reviews, disputes. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import type { components } from "../schema";
import { asPage } from "../types";

type S = components["schemas"];
export type PaymentIntent = S["PaymentIntent"];
export type PaymentRefund = S["PaymentRefund"];
export type Balance = S["PaymentBalance"];
export type Payout = S["Payout"];
export type Seller = S["MarketSeller"];
export type Review = S["MarketReview"];
export type Order = S["MarketOrder"];

function useMoneyMutation<A, R>(fn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [
        "payments",
        "payment",
        "balance",
        "payouts",
        "seller",
        "sellerReviews",
        "order",
        "orders",
        "disputes",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

// -------------------------------------------------------------------- payments
export function useMyPayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => asPage<PaymentIntent>(await unwrap(api.GET("/api/v1/payments/"))),
  });
}

export function usePayment(reference: string | undefined) {
  return useQuery({
    queryKey: ["payment", reference],
    enabled: Boolean(reference),
    queryFn: () => unwrap(api.GET("/api/v1/payments/{reference}/", { params: { path: { reference: reference! } } })),
  });
}

export function useRefunds(reference: string | undefined) {
  return useQuery({
    queryKey: ["payment", reference, "refunds"],
    enabled: Boolean(reference),
    queryFn: async () =>
      asPage<PaymentRefund>(
        await unwrap(api.GET("/api/v1/payments/{reference}/refunds/", { params: { path: { reference: reference! } } })),
      ).results,
  });
}

/** Staff: refund all or part of a payment. */
export const useRefund = (reference: string) =>
  useMoneyMutation((body: S["PaymentRefundCreateRequest"]) =>
    unwrap(api.POST("/api/v1/payments/{reference}/refunds/", { params: { path: { reference } }, body })),
  );

export function usePaymentProviders() {
  return useQuery({
    queryKey: ["paymentProviders"],
    staleTime: Infinity,
    queryFn: async () => asPage<S["PaymentProvider"]>(await unwrap(api.GET("/api/v1/payments/providers/"))).results,
  });
}

// --------------------------------------------------------------- balance/payouts
export function useBalance() {
  return useQuery({
    queryKey: ["balance"],
    queryFn: async () => asPage<Balance>(await unwrap(api.GET("/api/v1/payments/me/balance/"))).results,
  });
}

export function useMyPayouts() {
  return useQuery({
    queryKey: ["payouts", "mine"],
    queryFn: async () => asPage<Payout>(await unwrap(api.GET("/api/v1/payments/me/payouts/"))).results,
  });
}

export const useRequestPayout = () =>
  useMoneyMutation((body: S["PayoutCreateRequest"]) => unwrap(api.POST("/api/v1/payments/me/payouts/", { body })));

export const useCancelPayout = () =>
  useMoneyMutation((id: string) =>
    unwrap(api.POST("/api/v1/payments/me/payouts/{payout_id}/cancel/", { params: { path: { payout_id: id } } })),
  );

/** Staff: payout requests to process. */
export function usePayoutQueue(status: string) {
  return useQuery({
    queryKey: ["payouts", "queue", status],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<Payout>(
        await unwrap(api.GET("/api/v1/payments/payouts/", { params: { query: { status: status || undefined } } })),
      ).results,
  });
}

export const useDecidePayout = () =>
  useMoneyMutation(({ id, approve, body }: { id: string; approve: boolean; body: S["PayoutDecisionRequest"] }) =>
    approve
      ? unwrap(api.POST("/api/v1/payments/payouts/{payout_id}/approve/", { params: { path: { payout_id: id } }, body }))
      : unwrap(api.POST("/api/v1/payments/payouts/{payout_id}/reject/", { params: { path: { payout_id: id } }, body })),
  );

// ---------------------------------------------------------------------- shops
export function useMySeller() {
  return useQuery({ queryKey: ["seller", "me"], queryFn: () => unwrap(api.GET("/api/v1/marketplace/me/seller/")) });
}

export const useUpdateSeller = () =>
  useMoneyMutation((body: S["PatchedMarketSellerWriteRequest"]) =>
    unwrap(api.PATCH("/api/v1/marketplace/me/seller/", { body })),
  );

export function useSeller(lookup: string | undefined) {
  return useQuery({
    queryKey: ["seller", lookup],
    enabled: Boolean(lookup),
    queryFn: () => unwrap(api.GET("/api/v1/marketplace/sellers/{lookup}/", { params: { path: { lookup: lookup! } } })),
  });
}

export function useSellerReviews(lookup: string | undefined) {
  return useQuery({
    queryKey: ["sellerReviews", lookup],
    enabled: Boolean(lookup),
    queryFn: async () =>
      asPage<Review>(
        await unwrap(
          api.GET("/api/v1/marketplace/sellers/{lookup}/reviews/", { params: { path: { lookup: lookup! } } }),
        ),
      ).results,
  });
}

export const useReplyToReview = () =>
  useMoneyMutation(({ id, reply }: { id: string; reply: string }) =>
    unwrap(
      api.POST("/api/v1/marketplace/reviews/{review_id}/reply/", {
        params: { path: { review_id: id } },
        body: { reply },
      }),
    ),
  );

// ---------------------------------------------------------------------- orders
export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["order", id],
    enabled: Boolean(id),
    queryFn: () => unwrap(api.GET("/api/v1/marketplace/orders/{order_id}/", { params: { path: { order_id: id! } } })),
  });
}

export const useReviewOrder = (id: string) =>
  useMoneyMutation((body: S["MarketReviewCreateRequest"]) =>
    unwrap(api.POST("/api/v1/marketplace/orders/{order_id}/review/", { params: { path: { order_id: id } }, body })),
  );

export const useDisputeOrder = (id: string) =>
  useMoneyMutation((reason: string) =>
    unwrap(
      api.POST("/api/v1/marketplace/orders/{order_id}/dispute/", {
        params: { path: { order_id: id } },
        body: { reason },
      }),
    ),
  );

/** Staff: open disputes. */
export function useDisputes() {
  return useQuery({
    queryKey: ["disputes"],
    queryFn: async () => asPage<Order>(await unwrap(api.GET("/api/v1/marketplace/disputes/"))).results,
  });
}

export const useResolveDispute = () =>
  useMoneyMutation(({ id, body }: { id: string; body: S["MarketResolveRequest"] }) =>
    unwrap(api.POST("/api/v1/marketplace/orders/{order_id}/resolve/", { params: { path: { order_id: id } }, body })),
  );

export const useDeleteListingImage = () =>
  useMoneyMutation(({ listingId, imageId }: { listingId: string; imageId: string }) =>
    unwrap(
      api.DELETE("/api/v1/marketplace/listings/{listing_id}/images/{image_id}/", {
        params: { path: { listing_id: listingId, image_id: imageId } },
      }),
    ),
  );
