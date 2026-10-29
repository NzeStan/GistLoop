import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import type { components } from "../schema";
import { type EventDetail, type EventRegistration, type EventSummary, asPage } from "../types";
import { uploadFile } from "../upload";

type S = components["schemas"];

export interface EventFilters {
  q?: string;
  format?: "in_person" | "online" | "hybrid";
  free?: boolean;
}

export const eventKeys = {
  list: (filters: EventFilters) => ["events", filters] as const,
  detail: (slug: string) => ["event", slug] as const,
  mine: ["myRegistrations"] as const,
};

export function useEvents(filters: EventFilters = {}) {
  return useQuery({
    queryKey: eventKeys.list(filters),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<EventSummary>(
        await unwrap(
          api.GET("/api/v1/events/", {
            params: {
              query: {
                q: filters.q || undefined,
                format: filters.format,
                free: filters.free ? "true" : undefined,
                from: new Date().toISOString(),
              },
            },
          }),
        ),
      ),
  });
}

export function useEvent(slug: string | undefined) {
  return useQuery({
    queryKey: eventKeys.detail(slug ?? ""),
    enabled: Boolean(slug),
    queryFn: () => unwrap(api.GET("/api/v1/events/by-slug/{slug}/", { params: { path: { slug: slug! } } })),
  });
}

export function useMyRegistrations(enabled = true) {
  return useQuery({
    queryKey: eventKeys.mine,
    enabled,
    queryFn: async () =>
      asPage<EventRegistration>(
        await unwrap(api.GET("/api/v1/me/event-registrations/", { params: { query: { upcoming: true } } })),
      ).results,
  });
}

export function useRegisterForEvent(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, ticketType }: { eventId: string; ticketType?: string }) =>
      unwrap(
        api.POST("/api/v1/events/{event_id}/register/", {
          params: { path: { event_id: eventId } },
          body: { ticket_type: ticketType ?? null },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: eventKeys.mine });
    },
  });
}

export function useCancelRegistration(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) =>
      unwrap(api.DELETE("/api/v1/events/{event_id}/registration/", { params: { path: { event_id: eventId } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: eventKeys.mine });
    },
  });
}

// ------------------------------------------------------------------ organising
export function useCreateEvent() {
  return useMutation({
    mutationFn: (body: S["EventsEventWriteRequest"]) => unwrap(api.POST("/api/v1/events/", { body })),
  });
}

export function useUploadEventCover() {
  return useMutation({
    mutationFn: ({ eventId, file }: { eventId: string; file: File }) =>
      uploadFile<EventDetail>(`/api/v1/events/${eventId}/cover/`, file),
  });
}

export function useCreateTicketType() {
  return useMutation({
    mutationFn: ({ eventId, body }: { eventId: string; body: S["EventsTicketTypeWriteRequest"] }) =>
      unwrap(api.POST("/api/v1/events/{event_id}/ticket-types/", { params: { path: { event_id: eventId } }, body })),
  });
}

export function usePublishEvent() {
  return useMutation({
    mutationFn: (eventId: string) =>
      unwrap(api.POST("/api/v1/events/{event_id}/publish/", { params: { path: { event_id: eventId } } })),
  });
}

/** All my tickets, including past ones and those awaiting payment. */
export function useMyTickets() {
  return useQuery({
    queryKey: ["myTickets"],
    queryFn: async () => asPage<EventRegistration>(await unwrap(api.GET("/api/v1/me/event-registrations/"))).results,
  });
}
