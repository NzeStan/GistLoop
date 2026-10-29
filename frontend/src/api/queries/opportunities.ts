import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../client";
import { api, unwrap } from "../client";
import { toApiError } from "../errors";
import type { components } from "../schema";
import { asPage } from "../types";
import { uploadFile } from "../upload";

type S = components["schemas"];

export type Opportunity = S["Opportunity"];
export type OpportunityApplication = S["OpportunityApplication"];
export type OpportunityKind = S["OpportunityKindEnum"];
export type WorkMode = S["WorkModeEnum"];

export interface OpportunityFilters {
  q?: string;
  kind?: OpportunityKind | "";
  work_mode?: WorkMode | "";
  paid?: boolean;
}

export const opportunityKeys = {
  list: (filters: OpportunityFilters) => ["opportunities", filters] as const,
  detail: (id: string) => ["opportunity", id] as const,
  mine: (which: "applications" | "saved" | "posted") => ["myOpportunities", which] as const,
  applicants: (id: string) => ["applicants", id] as const,
};

export function useOpportunities(filters: OpportunityFilters = {}) {
  return useQuery({
    queryKey: opportunityKeys.list(filters),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<Opportunity>(
        await unwrap(
          api.GET("/api/v1/opportunities/", {
            params: {
              query: {
                q: filters.q || undefined,
                kind: filters.kind || undefined,
                work_mode: filters.work_mode || undefined,
                paid: filters.paid ? "true" : undefined,
              },
            },
          }),
        ),
      ),
  });
}

export function useOpportunity(id: string | undefined) {
  return useQuery({
    queryKey: opportunityKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: () =>
      unwrap(api.GET("/api/v1/opportunities/{opportunity_id}/", { params: { path: { opportunity_id: id! } } })),
  });
}

export function useMyOpportunities(which: "applications" | "saved" | "posted") {
  return useQuery({
    queryKey: opportunityKeys.mine(which),
    queryFn: async () => {
      if (which === "applications")
        return asPage<OpportunityApplication>(await unwrap(api.GET("/api/v1/opportunities/me/applications/")));
      const data =
        which === "saved"
          ? await unwrap(api.GET("/api/v1/opportunities/me/saved/"))
          : await unwrap(api.GET("/api/v1/opportunities/me/posted/"));
      return asPage<Opportunity>(data);
    },
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return (opportunity?: Opportunity) => {
    if (opportunity) queryClient.setQueryData(opportunityKeys.detail(opportunity.id), opportunity);
    void queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    void queryClient.invalidateQueries({ queryKey: ["myOpportunities"] });
  };
}

export function useCreateOpportunity() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: S["OpportunityWriteRequest"]) => unwrap(api.POST("/api/v1/opportunities/", { body })),
    onSuccess: (opportunity) => refresh(opportunity),
  });
}

export function useOpportunityStatus() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: S["OpportunityStatusActionActionEnum"] }) =>
      unwrap(
        api.POST("/api/v1/opportunities/{opportunity_id}/status/", {
          params: { path: { opportunity_id: id } },
          body: { action },
        }),
      ),
    onSuccess: (opportunity) => refresh(opportunity),
  });
}

export function useToggleSaveOpportunity() {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => {
      const params = { path: { opportunity_id: id } };
      return saved
        ? unwrap(api.DELETE("/api/v1/opportunities/{opportunity_id}/save/", { params }))
        : unwrap(api.POST("/api/v1/opportunities/{opportunity_id}/save/", { params }));
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: opportunityKeys.detail(id) });
      refresh();
    },
  });
}

export interface Application {
  cover_note: string;
  contact_email: string;
  resume: File | null;
}

/** Apply in the app. A CV goes up as multipart (PDF only, checked again by the API). */
export function useApply(id: string) {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ cover_note, contact_email, resume }: Application) => {
      const fields = { cover_note, ...(contact_email ? { contact_email } : {}) };
      if (resume)
        return uploadFile<OpportunityApplication>(`/api/v1/opportunities/${id}/apply/`, resume, fields, "resume");
      return unwrap(
        api.POST("/api/v1/opportunities/{opportunity_id}/apply/", {
          params: { path: { opportunity_id: id } },
          body: fields,
        }),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: opportunityKeys.detail(id) });
      refresh();
    },
  });
}

export function useWithdrawApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: string) =>
      unwrap(
        api.POST("/api/v1/opportunities/applications/{application_id}/withdraw/", {
          params: { path: { application_id: applicationId } },
        }),
      ),
    onSuccess: (application) => {
      void queryClient.invalidateQueries({ queryKey: ["myOpportunities"] });
      void queryClient.invalidateQueries({ queryKey: opportunityKeys.detail(application.opportunity.id) });
    },
  });
}

export function useApplicants(id: string | undefined) {
  return useQuery({
    queryKey: opportunityKeys.applicants(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () =>
      asPage<OpportunityApplication>(
        await unwrap(
          api.GET("/api/v1/opportunities/{opportunity_id}/applications/", {
            params: { path: { opportunity_id: id! } },
          }),
        ),
      ),
  });
}

export function useDecideApplication(opportunityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, status }: { applicationId: string; status: S["OpportunityDecisionStatusEnum"] }) =>
      unwrap(
        api.PATCH("/api/v1/opportunities/applications/{application_id}/", {
          params: { path: { application_id: applicationId } },
          body: { status },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: opportunityKeys.applicants(opportunityId) }),
  });
}

/** Download an applicant's CV (private: the request carries sign-in, so it can't be a plain link). */
export async function downloadResume(application: OpportunityApplication): Promise<void> {
  let response: Response;
  try {
    response = await authFetch(
      new Request(new URL(`/api/v1/opportunities/applications/${application.id}/resume/`, window.location.origin)),
    );
  } catch {
    throw toApiError(0, undefined);
  }
  if (!response.ok) throw toApiError(response.status, undefined);
  const url = URL.createObjectURL(await response.blob());
  const name = `${application.applicant.display_name || "applicant"} CV.pdf`.replace(/[\\/:*?"<>|]/g, "");
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ------------------------------------------------------------------ announcements
export function useMyAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async () => asPage<S["InstitutionAnnouncement"]>(await unwrap(api.GET("/api/v1/me/announcements/"))),
  });
}
