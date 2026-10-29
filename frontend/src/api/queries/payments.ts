import { useMutation, useQuery } from "@tanstack/react-query";

import { api, unwrap } from "../client";

/** What a payment was for, and where to send the payer afterwards. */
export const PAYMENT_PURPOSES: Record<string, { label: string; next: string; cta: string }> = {
  "marketplace.order": { label: "your order", next: "/marketplace/orders", cta: "View your orders" },
  "events.registration": { label: "your ticket", next: "/events/tickets", cta: "View your tickets" },
};

/**
 * Start a checkout and leave for the payment page (Paystack). The payer comes back to the return
 * address configured on the server (/payments/return?reference=…), which confirms the payment.
 */
export async function startCheckout(purpose: string, objectId: string): Promise<void> {
  const intent = await unwrap(
    api.POST("/api/v1/payments/checkout/", {
      params: { header: { "Idempotency-Key": crypto.randomUUID() } },
      body: { purpose, object_id: objectId },
    }),
  );
  window.location.assign(intent.checkout_url);
}

export function useCheckout() {
  return useMutation({
    mutationFn: ({ purpose, objectId }: { purpose: string; objectId: string }) => startCheckout(purpose, objectId),
  });
}

/**
 * Ask the API to confirm a payment with the provider. Never trust the return URL alone: only the
 * server's answer says whether money arrived. Pending payments are re-checked every few seconds.
 */
export function useVerifyPayment(reference: string | null) {
  return useQuery({
    queryKey: ["payment", reference],
    enabled: Boolean(reference),
    retry: 1,
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 3000 : false),
    queryFn: () =>
      unwrap(api.POST("/api/v1/payments/{reference}/verify/", { params: { path: { reference: reference! } } })),
  });
}
