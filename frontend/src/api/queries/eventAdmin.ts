/** Running an event: edit, cancel, agenda, organisers, attendees, check-in, tickets, venues. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, authFetch, unwrap } from "../client";
import { UserFacingError } from "../errors";
import type { components } from "../schema";
import { asPage } from "../types";
import { uploadFile } from "../upload";

type S = components["schemas"];
export type ManagedEvent = S["EventsEvent"];
export type EventUpdate = S["PatchedEventsEventWriteRequest"];
export type EventSession = S["EventsSession"];
export type SessionWrite = S["EventsSessionWriteRequest"];
export type Organizer = S["EventsOrganizer"];
export type Attendee = S["EventsAttendee"];
export type TicketType = S["EventsTicketType"];
export type Venue = S["EventsVenue"];
export type VenueWrite = S["EventsVenueWriteRequest"];
export type EventSummary = S["EventsEventList"];

const keys = {
  mine: ["myOrganisedEvents"] as const,
  event: (id: string) => ["manageEvent", id] as const,
  part: (id: string, part: string) => ["manageEvent", id, part] as const,
  venues: (q: string) => ["venues", q] as const,
};

function useEventMutation<A, R>(fn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ["manageEvent", "myOrganisedEvents", "event", "events", "venues"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useMyOrganisedEvents() {
  return useQuery({
    queryKey: keys.mine,
    queryFn: async () => asPage<EventSummary>(await unwrap(api.GET("/api/v1/me/events/"))).results,
  });
}

export function useManagedEvent(id: string | undefined) {
  return useQuery({
    queryKey: keys.event(id ?? ""),
    enabled: Boolean(id),
    queryFn: () => unwrap(api.GET("/api/v1/events/{event_id}/", { params: { path: { event_id: id! } } })),
  });
}

export const useUpdateEvent = (id: string) =>
  useEventMutation((body: EventUpdate) =>
    unwrap(api.PATCH("/api/v1/events/{event_id}/", { params: { path: { event_id: id } }, body })),
  );

export const useCancelEvent = (id: string) =>
  useEventMutation((reason: string) =>
    unwrap(api.POST("/api/v1/events/{event_id}/cancel/", { params: { path: { event_id: id } }, body: { reason } })),
  );

export const useDeleteEvent = () =>
  useEventMutation((id: string) =>
    unwrap(api.DELETE("/api/v1/events/{event_id}/", { params: { path: { event_id: id } } })),
  );

export const usePublishManagedEvent = (id: string) =>
  useEventMutation(() =>
    unwrap(api.POST("/api/v1/events/{event_id}/publish/", { params: { path: { event_id: id } } })),
  );

export const useEventCover = (id: string) =>
  useEventMutation((file: File | null) =>
    file
      ? uploadFile(`/api/v1/events/${id}/cover/`, file)
      : unwrap(api.DELETE("/api/v1/events/{event_id}/cover/", { params: { path: { event_id: id } } })),
  );

export const useTransferEvent = (id: string) =>
  useEventMutation((userId: string) =>
    unwrap(
      api.POST("/api/v1/events/{event_id}/transfer-ownership/", {
        params: { path: { event_id: id } },
        body: { user_id: userId },
      }),
    ),
  );

// ----------------------------------------------------------------------- agenda
export function useSessions(id: string | undefined) {
  return useQuery({
    queryKey: keys.part(id ?? "", "sessions"),
    enabled: Boolean(id),
    queryFn: async () =>
      asPage<EventSession>(
        await unwrap(api.GET("/api/v1/events/{event_id}/sessions/", { params: { path: { event_id: id! } } })),
      ).results,
  });
}

export const useSaveSession = (id: string) =>
  useEventMutation(({ sessionId, body }: { sessionId?: string; body: SessionWrite }) =>
    sessionId
      ? unwrap(
          api.PATCH("/api/v1/events/{event_id}/sessions/{session_id}/", {
            params: { path: { event_id: id, session_id: sessionId } },
            body,
          }),
        )
      : unwrap(api.POST("/api/v1/events/{event_id}/sessions/", { params: { path: { event_id: id } }, body })),
  );

export const useDeleteSession = (id: string) =>
  useEventMutation((sessionId: string) =>
    unwrap(
      api.DELETE("/api/v1/events/{event_id}/sessions/{session_id}/", {
        params: { path: { event_id: id, session_id: sessionId } },
      }),
    ),
  );

// ------------------------------------------------------------------- organisers
export function useOrganizers(id: string | undefined) {
  return useQuery({
    queryKey: keys.part(id ?? "", "organizers"),
    enabled: Boolean(id),
    queryFn: async () =>
      asPage<Organizer>(
        await unwrap(api.GET("/api/v1/events/{event_id}/organizers/", { params: { path: { event_id: id! } } })),
      ).results,
  });
}

export const useAddOrganizer = (id: string) =>
  useEventMutation((body: S["EventsOrganizerWriteRequest"]) =>
    unwrap(api.POST("/api/v1/events/{event_id}/organizers/", { params: { path: { event_id: id } }, body })),
  );

export const useRemoveOrganizer = (id: string) =>
  useEventMutation((userId: string) =>
    unwrap(
      api.DELETE("/api/v1/events/{event_id}/organizers/{user_id}/", {
        params: { path: { event_id: id, user_id: userId } },
      }),
    ),
  );

// -------------------------------------------------------------------- attendees
export function useAttendees(id: string | undefined, filters: { status?: string; checked_in?: string; page?: number }) {
  return useQuery({
    queryKey: [...keys.part(id ?? "", "attendees"), filters],
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<Attendee>(
        await unwrap(
          api.GET("/api/v1/events/{event_id}/registrations/", {
            params: {
              path: { event_id: id! },
              query: {
                status: filters.status || undefined,
                checked_in: filters.checked_in ? filters.checked_in === "yes" : undefined,
              } as Record<string, string | boolean | undefined>,
            },
          }),
        ),
      ),
  });
}

export const useDecideRegistration = (id: string) =>
  useEventMutation(
    ({ registrationId, approve, reason }: { registrationId: string; approve: boolean; reason?: string }) => {
      const args = {
        params: { path: { event_id: id, registration_id: registrationId } },
        body: { reason: reason ?? "" },
      };
      return approve
        ? unwrap(api.POST("/api/v1/events/{event_id}/registrations/{registration_id}/approve/", args))
        : unwrap(api.POST("/api/v1/events/{event_id}/registrations/{registration_id}/decline/", args));
    },
  );

export const useCheckIn = (id: string) =>
  useEventMutation((code: string) =>
    unwrap(api.POST("/api/v1/events/{event_id}/check-in/", { params: { path: { event_id: id } }, body: { code } })),
  );

/** Download the attendee list as a spreadsheet (CSV). */
export async function downloadAttendees(id: string, slug: string): Promise<void> {
  const response = await authFetch(
    new Request(new URL(`/api/v1/events/${id}/registrations/export.csv`, window.location.origin)),
  );
  if (!response.ok) throw new UserFacingError("Couldn't download the attendee list.");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-attendees.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------- tickets
export const useUpdateTicketType = (id: string) =>
  useEventMutation(({ ticketId, body }: { ticketId: string; body: S["PatchedEventsTicketTypeWriteRequest"] }) =>
    unwrap(
      api.PATCH("/api/v1/events/{event_id}/ticket-types/{ticket_type_id}/", {
        params: { path: { event_id: id, ticket_type_id: ticketId } },
        body,
      }),
    ),
  );

export const useDeleteTicketType = (id: string) =>
  useEventMutation((ticketId: string) =>
    unwrap(
      api.DELETE("/api/v1/events/{event_id}/ticket-types/{ticket_type_id}/", {
        params: { path: { event_id: id, ticket_type_id: ticketId } },
      }),
    ),
  );

export const useAddTicketType = (id: string) =>
  useEventMutation((body: S["EventsTicketTypeWriteRequest"]) =>
    unwrap(api.POST("/api/v1/events/{event_id}/ticket-types/", { params: { path: { event_id: id } }, body })),
  );

// ----------------------------------------------------------------------- venues
export function useVenues(q: string) {
  return useQuery({
    queryKey: keys.venues(q),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<Venue>(
        await unwrap(api.GET("/api/v1/venues/", { params: { query: { q: q || undefined, country: "NG" } } })),
      ).results,
  });
}

export const useSaveVenue = () =>
  useEventMutation(({ venueId, body }: { venueId?: string; body: VenueWrite }) =>
    venueId
      ? unwrap(api.PATCH("/api/v1/venues/{venue_id}/", { params: { path: { venue_id: venueId } }, body }))
      : unwrap(api.POST("/api/v1/venues/", { body })),
  );

export function useVenue(id: string | undefined) {
  return useQuery({
    queryKey: ["venue", id],
    enabled: Boolean(id),
    queryFn: () => unwrap(api.GET("/api/v1/venues/{venue_id}/", { params: { path: { venue_id: id! } } })),
  });
}
