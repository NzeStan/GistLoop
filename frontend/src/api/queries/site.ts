import { useMutation, useQuery } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import type { components } from "../schema";

type S = components["schemas"];

export function useContactTopics() {
  return useQuery({
    queryKey: ["contactTopics"],
    staleTime: Infinity,
    queryFn: () => unwrap(api.GET("/api/v1/site/contact/topics/")),
  });
}

export function useSendContactMessage() {
  return useMutation({
    mutationFn: (body: S["SiteContactRequest"]) => unwrap(api.POST("/api/v1/site/contact/", { body })),
  });
}

export function useSubscribeNewsletter() {
  return useMutation({
    mutationFn: (body: S["SiteNewsletterRequest"]) => unwrap(api.POST("/api/v1/site/newsletter/", { body })),
  });
}

export function useNewsletterToken(action: "confirm" | "unsubscribe") {
  return useMutation({
    mutationFn: (token: string) =>
      action === "confirm"
        ? unwrap(api.POST("/api/v1/site/newsletter/confirm/", { body: { token } }))
        : unwrap(api.POST("/api/v1/site/newsletter/unsubscribe/", { body: { token } })),
  });
}
