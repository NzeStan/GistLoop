import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import type { components } from "../schema";
import { asPage, nextParam } from "../types";

type S = components["schemas"];

export type Conversation = S["MessagingConversation"];
export type Message = S["MessagingMessage"];
export type Folder = "inbox" | "requests" | "archived";

export const messagingKeys = {
  conversations: (folder: Folder) => ["conversations", folder] as const,
  conversation: (id: string) => ["conversation", id] as const,
  messages: (id: string) => ["messages", id] as const,
  unread: ["messagingUnread"] as const,
  settings: ["messagingSettings"] as const,
};

/** Unread conversations, messages and requests; refreshed every half-minute while signed in. */
export function useMessagingUnread(enabled: boolean) {
  return useQuery({
    queryKey: messagingKeys.unread,
    enabled,
    refetchInterval: 30_000,
    queryFn: () => unwrap(api.GET("/api/v1/messaging/unread/")),
  });
}

export function useConversations(folder: Folder) {
  return useQuery({
    queryKey: messagingKeys.conversations(folder),
    refetchInterval: 30_000,
    queryFn: async () =>
      asPage<Conversation>(
        await unwrap(api.GET("/api/v1/messaging/conversations/", { params: { query: { folder } } })),
      ),
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: messagingKeys.conversation(id ?? ""),
    enabled: Boolean(id),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/messaging/conversations/{conversation_id}/", { params: { path: { conversation_id: id! } } }),
      ),
  });
}

/** Messages newest first, a page at a time (cursor); polled so new replies show up. */
export function useMessages(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: messagingKeys.messages(id ?? ""),
    enabled: Boolean(id),
    initialPageParam: "",
    refetchInterval: 10_000,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET("/api/v1/messaging/conversations/{conversation_id}/messages/", {
          params: { path: { conversation_id: id! }, query: { cursor: pageParam || undefined } },
        }),
      ),
    getNextPageParam: (last) => nextParam(last.next, "cursor"),
  });
}

function useRefreshConversations() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    void queryClient.invalidateQueries({ queryKey: messagingKeys.unread });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: messagingKeys.conversation(id) });
      void queryClient.invalidateQueries({ queryKey: messagingKeys.messages(id) });
    }
  };
}

export function useStartConversation() {
  const refresh = useRefreshConversations();
  return useMutation({
    mutationFn: (body: S["MessagingStartRequest"]) => unwrap(api.POST("/api/v1/messaging/conversations/", { body })),
    onSuccess: (conversation) => refresh(conversation.id),
  });
}

export function useSendMessage(id: string) {
  const refresh = useRefreshConversations();
  return useMutation({
    mutationFn: (body: S["MessagingSendRequest"]) =>
      unwrap(
        api.POST("/api/v1/messaging/conversations/{conversation_id}/messages/", {
          params: { path: { conversation_id: id } },
          body,
        }),
      ),
    onSuccess: () => refresh(id),
  });
}

export function useMarkConversationRead() {
  const refresh = useRefreshConversations();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/messaging/conversations/{conversation_id}/read/", {
          params: { path: { conversation_id: id } },
        }),
      ),
    onSuccess: () => refresh(),
  });
}

export type ConversationAction =
  { kind: "accept" | "decline" | "leave" } | { kind: "update"; body: S["PatchedMessagingConversationUpdateRequest"] };

export function useConversationAction(id: string) {
  const refresh = useRefreshConversations();
  return useMutation({
    mutationFn: (action: ConversationAction) => {
      const params = { path: { conversation_id: id } };
      switch (action.kind) {
        case "accept":
          return unwrap(api.POST("/api/v1/messaging/conversations/{conversation_id}/accept/", { params }));
        case "decline":
          return unwrap(api.POST("/api/v1/messaging/conversations/{conversation_id}/decline/", { params }));
        case "leave":
          return unwrap(api.POST("/api/v1/messaging/conversations/{conversation_id}/leave/", { params }));
        case "update":
          return unwrap(api.PATCH("/api/v1/messaging/conversations/{conversation_id}/", { params, body: action.body }));
      }
    },
    onSuccess: () => refresh(id),
  });
}

export function useMessageAction(conversationId: string) {
  const refresh = useRefreshConversations();
  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: string; body?: string }) => {
      const params = { path: { message_id: messageId } };
      return body === undefined
        ? unwrap(api.DELETE("/api/v1/messaging/messages/{message_id}/", { params }))
        : unwrap(api.PATCH("/api/v1/messaging/messages/{message_id}/", { params, body: { body } }));
    },
    onSuccess: () => refresh(conversationId),
  });
}

export function useMessagingSettings() {
  return useQuery({ queryKey: messagingKeys.settings, queryFn: () => unwrap(api.GET("/api/v1/messaging/settings/")) });
}

export function useUpdateMessagingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: S["PatchedMessagingSettingsRequest"]) =>
      unwrap(api.PATCH("/api/v1/messaging/settings/", { body })),
    onSuccess: (data) => queryClient.setQueryData(messagingKeys.settings, data),
  });
}
