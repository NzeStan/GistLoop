import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import type { components } from "../schema";
import { asPage } from "../types";

type S = components["schemas"];

/**
 * The anonymous inbox: anyone signed in can send a member a question without revealing who they
 * are; the member answers privately or publicly. Senders are never shown, even to the owner.
 */
export const inboxKeys = {
  settings: ["inbox"] as const,
  messages: (unanswered: boolean) => ["inboxMessages", unanswered] as const,
  publicInbox: (handle: string) => ["publicInbox", handle] as const,
  answers: (handle: string) => ["publicAnswers", handle] as const,
};

export function useMyInbox() {
  return useQuery({ queryKey: inboxKeys.settings, queryFn: () => unwrap(api.GET("/api/v1/anonymous/me/inbox/")) });
}

export function useUpdateInbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: S["PatchedAnonymousInboxUpdateRequest"]) =>
      unwrap(api.PATCH("/api/v1/anonymous/me/inbox/", { body })),
    onSuccess: (inbox) => queryClient.setQueryData(inboxKeys.settings, inbox),
  });
}

export function useInboxMessages(unanswered: boolean) {
  return useQuery({
    queryKey: inboxKeys.messages(unanswered),
    queryFn: async () =>
      asPage<S["AnonymousInboxMessage"]>(
        await unwrap(
          api.GET("/api/v1/anonymous/me/inbox/messages/", {
            params: { query: { unanswered: unanswered || undefined } },
          }),
        ),
      ),
  });
}

export type InboxAction =
  | { kind: "read"; id: string }
  | { kind: "answer"; id: string; answer: string; public: boolean }
  | { kind: "unanswer"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "block"; id: string };

export function useInboxAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: InboxAction) => {
      const params = { path: { message_id: action.id } };
      switch (action.kind) {
        case "read":
          return unwrap(api.POST("/api/v1/anonymous/me/inbox/messages/{message_id}/read/", { params }));
        case "answer":
          return unwrap(
            api.POST("/api/v1/anonymous/me/inbox/messages/{message_id}/answer/", {
              params,
              body: { answer: action.answer, public: action.public },
            }),
          );
        case "unanswer":
          return unwrap(api.DELETE("/api/v1/anonymous/me/inbox/messages/{message_id}/answer/", { params }));
        case "delete":
          return unwrap(api.DELETE("/api/v1/anonymous/me/inbox/messages/{message_id}/", { params }));
        case "block":
          return unwrap(api.POST("/api/v1/anonymous/me/inbox/messages/{message_id}/block-sender/", { params }));
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inboxMessages"] });
      void queryClient.invalidateQueries({ queryKey: inboxKeys.settings });
    },
  });
}

export function usePublicInbox(handle: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.publicInbox(handle ?? ""),
    enabled: Boolean(handle),
    retry: false,
    queryFn: () => unwrap(api.GET("/api/v1/anonymous/inboxes/{handle}/", { params: { path: { handle: handle! } } })),
  });
}

export function usePublicAnswers(handle: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.answers(handle ?? ""),
    enabled: Boolean(handle),
    queryFn: async () =>
      asPage<S["AnonymousPublicAnswer"]>(
        await unwrap(api.GET("/api/v1/anonymous/inboxes/{handle}/answers/", { params: { path: { handle: handle! } } })),
      ),
  });
}

export function useSendAnonymousMessage(handle: string) {
  return useMutation({
    mutationFn: (body: string) =>
      unwrap(
        api.POST("/api/v1/anonymous/inboxes/{handle}/messages/", { params: { path: { handle } }, body: { body } }),
      ),
  });
}
