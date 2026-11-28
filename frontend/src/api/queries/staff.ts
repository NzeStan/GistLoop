/** Moderation (yours and the staff's), and the staff console: people, roles, audit, reviews. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { request } from "../http";
import type { components } from "../schema";
import { type PublicProfile, asPage } from "../types";

type S = components["schemas"];
export type CaseSummary = S["CaseList"];
export type CaseDetail = S["CaseDetail"];
export type ModerationActionName = S["ModerationActionEnum"];
export type MyAction = S["MyAction"];
export type MyReport = S["MyReport"];
export type Appeal = S["Appeal"];
export type Rule = S["Rule"];
export type Role = S["Role"];
export type RoleAssignment = S["RoleAssignment"];
export type AuditEntry = S["AuditLog"];
export type RevealRequest = S["AnonymousRevealRequest"];
export type SocialPost = S["SocialPost"];
export type SocialChannel = S["SocialChannel"];
export type Restriction = S["Restriction"];

function useStaffMutation<A, R>(fn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ["moderation", "staff", "social", "promotions", "opportunities", "profile"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

// ------------------------------------------------------------- your safety
export function useMyReports() {
  return useQuery({
    queryKey: ["moderation", "myReports"],
    queryFn: async () => asPage<MyReport>(await unwrap(api.GET("/api/v1/moderation/me/reports/"))).results,
  });
}

export function useActionsAgainstMe() {
  return useQuery({
    queryKey: ["moderation", "myActions"],
    queryFn: async () => asPage<MyAction>(await unwrap(api.GET("/api/v1/moderation/me/actions/"))).results,
  });
}

export function useMyAppeals() {
  return useQuery({
    queryKey: ["moderation", "myAppeals"],
    queryFn: async () => asPage<MyAction>(await unwrap(api.GET("/api/v1/moderation/me/appeals/"))).results,
  });
}

export const useFileAppeal = () =>
  useStaffMutation((body: S["AppealCreateRequest"]) => unwrap(api.POST("/api/v1/moderation/appeals/", { body })));

// --------------------------------------------------------- staff: moderation
export interface CaseFilters {
  status?: string;
  content_type?: string;
  assigned?: string;
}

export function useCases(filters: CaseFilters, enabled = true) {
  return useQuery({
    queryKey: ["moderation", "cases", filters],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<CaseSummary>(
        await unwrap(
          api.GET("/api/v1/moderation/cases/", {
            params: {
              query: {
                status: filters.status || undefined,
                content_type: filters.content_type || undefined,
                assigned: filters.assigned || undefined,
              } as Record<string, string | undefined>,
            },
          }),
        ),
      ),
  });
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: ["moderation", "case", id],
    enabled: Boolean(id),
    queryFn: () => unwrap(api.GET("/api/v1/moderation/cases/{case_id}/", { params: { path: { case_id: id! } } })),
  });
}

export const useOpenCase = () =>
  useStaffMutation((body: S["CaseOpenRequest"]) => unwrap(api.POST("/api/v1/moderation/cases/", { body })));

export const useAssignCase = () =>
  useStaffMutation((id: string) =>
    unwrap(api.POST("/api/v1/moderation/cases/{case_id}/assign/", { params: { path: { case_id: id } } })),
  );

export const useTakeAction = (caseId: string) =>
  useStaffMutation((body: S["ActionCreateRequest"]) =>
    unwrap(api.POST("/api/v1/moderation/cases/{case_id}/actions/", { params: { path: { case_id: caseId } }, body })),
  );

export function useAppealQueue(status: string, enabled = true) {
  return useQuery({
    queryKey: ["moderation", "appeals", status],
    enabled,
    queryFn: async () =>
      asPage<Appeal>(
        await unwrap(
          api.GET("/api/v1/moderation/appeal-queue/", { params: { query: { status: status || undefined } } }),
        ),
      ).results,
  });
}

export const useDecideAppeal = () =>
  useStaffMutation(({ id, overturn, reason }: { id: string; overturn: boolean; reason: string }) =>
    unwrap(
      api.POST("/api/v1/moderation/appeals/{appeal_id}/decide/", {
        params: { path: { appeal_id: id } },
        body: { overturn, reason },
      }),
    ),
  );

export function useRules(enabled = true) {
  return useQuery({
    queryKey: ["moderation", "rules"],
    enabled,
    queryFn: async () => asPage<Rule>(await unwrap(api.GET("/api/v1/moderation/rules/"))).results,
  });
}

export const useUpdateRule = () =>
  useStaffMutation(({ id, body }: { id: string; body: S["PatchedRuleRequest"] }) =>
    unwrap(api.PATCH("/api/v1/moderation/rules/{id}/", { params: { path: { id } }, body })),
  );

export function useRestrictions(enabled = true) {
  return useQuery({
    queryKey: ["moderation", "restrictions"],
    enabled,
    queryFn: async () => asPage<Restriction>(await unwrap(api.GET("/api/v1/platform/restrictions/"))).results,
  });
}

export const useLiftRestriction = () =>
  useStaffMutation((id: string) =>
    unwrap(
      api.POST("/api/v1/moderation/restrictions/{restriction_id}/lift/", { params: { path: { restriction_id: id } } }),
    ),
  );

// -------------------------------------------------------------------- people
export function useUserByHandle(handle: string) {
  return useQuery({
    queryKey: ["staff", "user", handle],
    enabled: handle.length >= 2,
    retry: false,
    queryFn: () =>
      unwrap(api.GET("/api/v1/users/by-handle/{handle}/", { params: { path: { handle } } })) as Promise<PublicProfile>,
  });
}

export type AccountAction = "suspend" | "ban" | "reactivate" | "restore";

export const useAccountAction = () =>
  useStaffMutation(
    ({ userId, action, reason, until }: { userId: string; action: AccountAction; reason?: string; until?: string }) => {
      const path = { params: { path: { user_id: userId } } };
      switch (action) {
        case "suspend":
          return unwrap(
            api.POST("/api/v1/users/{user_id}/suspend/", {
              ...path,
              body: { reason: reason ?? "", until: until || null },
            }),
          );
        case "ban":
          return unwrap(api.POST("/api/v1/users/{user_id}/ban/", { ...path, body: { reason: reason ?? "" } }));
        case "reactivate":
          return unwrap(api.POST("/api/v1/users/{user_id}/reactivate/", path));
        default:
          return unwrap(api.POST("/api/v1/users/{user_id}/restore/", path));
      }
    },
  );

// ---------------------------------------------------------------------- roles
export function useRoles(enabled = true) {
  return useQuery({
    queryKey: ["staff", "roles"],
    enabled,
    queryFn: async () =>
      asPage<Role>(await unwrap(api.GET("/api/v1/roles/", { params: { query: { page_size: 200 } } }))).results,
  });
}

export function useAllPermissions(enabled = true) {
  return useQuery({
    queryKey: ["staff", "permissions"],
    enabled,
    queryFn: async () => asPage<S["Permission"]>(await unwrap(api.GET("/api/v1/permissions/"))).results,
  });
}

export const useSaveRole = () =>
  useStaffMutation(({ id, body }: { id?: string; body: S["RoleRequest"] }) =>
    id
      ? unwrap(api.PATCH("/api/v1/roles/{id}/", { params: { path: { id } }, body }))
      : unwrap(api.POST("/api/v1/roles/", { body })),
  );

/** Role assignments in a scope (the platform, a school, a community …). */
export function useRoleAssignments(scopeType: string, scopeId: string, enabled = true) {
  return useQuery({
    queryKey: ["staff", "assignments", scopeType, scopeId],
    enabled,
    queryFn: async () =>
      asPage<RoleAssignment>(
        await request("GET", "/api/v1/role-assignments/", {
          query: { scope_type: scopeType, scope_id: scopeId || undefined },
        }),
      ).results,
  });
}

export const useAssignRole = () =>
  useStaffMutation((body: S["RoleAssignmentCreateRequest"]) => unwrap(api.POST("/api/v1/role-assignments/", { body })));

export const useRevokeRole = () =>
  useStaffMutation((id: string) =>
    unwrap(api.DELETE("/api/v1/role-assignments/{assignment_id}/", { params: { path: { assignment_id: id } } })),
  );

// ---------------------------------------------------------------------- audit
export interface AuditFilters {
  action?: string;
  actor?: string;
  category?: string;
  outcome?: string;
  target_type?: string;
  target_id?: string;
  since?: string;
  until?: string;
  page?: number;
}

export function useAuditLog(filters: AuditFilters, enabled = true) {
  return useQuery({
    queryKey: ["staff", "audit", filters],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<AuditEntry>(
        await request("GET", "/api/v1/audit/logs/", {
          query: { ...filters, page_size: 50 } as Record<string, string | number | undefined>,
        }),
      ),
  });
}

// ------------------------------------------------------------ anonymous reveal
export function useRevealRequests(enabled = true) {
  return useQuery({
    queryKey: ["staff", "reveal"],
    enabled,
    queryFn: async () => asPage<RevealRequest>(await unwrap(api.GET("/api/v1/anonymous/reveal-requests/"))).results,
  });
}

export const useRequestReveal = () =>
  useStaffMutation((body: S["AnonymousRevealRequestCreateRequest"]) =>
    unwrap(api.POST("/api/v1/anonymous/reveal-requests/", { body })),
  );

export const useDecideReveal = () =>
  useStaffMutation(({ id, approve, reason }: { id: string; approve: boolean; reason: string }) =>
    unwrap(
      api.POST("/api/v1/anonymous/reveal-requests/{request_id}/decide/", {
        params: { path: { request_id: id } },
        body: { approve, reason },
      }),
    ),
  );

/** Each retrieval is counted and audited. */
export const fetchRevealedIdentity = (id: string) =>
  unwrap(api.GET("/api/v1/anonymous/reveal-requests/{request_id}/identity/", { params: { path: { request_id: id } } }));

// ------------------------------------------------------------ other reviews
export function usePromotionQueue(enabled = true) {
  return useQuery({
    queryKey: ["promotions", "queue"],
    enabled,
    queryFn: async () =>
      asPage<S["PromotionCampaign"]>(await unwrap(api.GET("/api/v1/promotions/review-queue/"))).results,
  });
}

export const useReviewPromotion = () =>
  useStaffMutation(({ id, approve, note }: { id: string; approve: boolean; note?: string }) =>
    unwrap(
      api.POST("/api/v1/promotions/campaigns/{campaign_id}/review/", {
        params: { path: { campaign_id: id } },
        body: { approve, note: note ?? "" },
      }),
    ),
  );

export const useVerifyOpportunity = () =>
  useStaffMutation(({ id, verified }: { id: string; verified: boolean }) =>
    unwrap(
      api.POST("/api/v1/opportunities/{opportunity_id}/verify/", {
        params: { path: { opportunity_id: id } },
        body: { verified },
      }),
    ),
  );

// ------------------------------------------------------------ social pages
export function useSocialChannels(enabled = true) {
  return useQuery({
    queryKey: ["social", "channels"],
    enabled,
    queryFn: async () => asPage<SocialChannel>(await unwrap(api.GET("/api/v1/syndication/channels/"))).results,
  });
}

export function useSocialQueue(status: string, enabled = true) {
  return useQuery({
    queryKey: ["social", "queue", status],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<SocialPost>(
        await unwrap(
          api.GET("/api/v1/syndication/items/", { params: { query: { status: (status || undefined) as never } } }),
        ),
      ).results,
  });
}

export type SocialAction = "approve" | "reject" | "retry" | "take-down";

export const useSocialAction = () =>
  useStaffMutation(({ id, action, note }: { id: string; action: SocialAction; note?: string }) => {
    const args = { params: { path: { item_id: id } }, body: { note: note ?? "" } };
    switch (action) {
      case "approve":
        return unwrap(api.POST("/api/v1/syndication/items/{item_id}/approve/", args));
      case "reject":
        return unwrap(api.POST("/api/v1/syndication/items/{item_id}/reject/", args));
      case "retry":
        return unwrap(api.POST("/api/v1/syndication/items/{item_id}/retry/", args));
      default:
        return unwrap(api.POST("/api/v1/syndication/items/{item_id}/take-down/", args));
    }
  });

// ------------------------------------------------------------ messaging
export const useAddParticipants = (conversationId: string) =>
  useStaffMutation((userIds: string[]) =>
    unwrap(
      api.POST("/api/v1/messaging/conversations/{conversation_id}/participants/", {
        params: { path: { conversation_id: conversationId } },
        body: { user_ids: userIds },
      }),
    ),
  );
