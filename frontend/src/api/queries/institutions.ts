/** Institutions (schools): the directory, joining and verifying, and running a school's space. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { UserFacingError } from "../errors";
import { request } from "../http";
import type { components } from "../schema";
import { asPage } from "../types";
import { uploadFile } from "../upload";

type S = components["schemas"];
export type Institution = S["Institution"];
export type Membership = S["Membership"];
export type Member = S["Member"];
export type Verification = S["Verification"];
export type Campus = S["Campus"];
export type AcademicUnit = S["AcademicUnit"];
export type Programme = S["Programme"];
export type Level = S["Level"];
export type AcademicSession = S["AcademicSession"];
export type SchoolDomain = S["Domain"];
export type Announcement = S["InstitutionAnnouncement"];
export type AnnouncementWrite = S["InstitutionAnnouncementWriteRequest"];
export type MembershipStatus = S["MembershipStatusEnum"];

export const ROLES = ["student", "staff", "lecturer", "administrator", "alumni", "guest"] as const;
export const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  staff: "Non-teaching staff",
  lecturer: "Lecturer",
  administrator: "Administrator",
  alumni: "Alumni",
  guest: "Visitor / guest",
  moderator: "Moderator",
  organization: "Organisation",
};
export const TYPE_LABELS: Record<string, string> = {
  university: "University",
  polytechnic: "Polytechnic",
  college_of_education: "College of Education",
  monotechnic: "Monotechnic",
  health_institution: "Health institution",
  vocational: "Vocational",
  other: "Other",
};
export const VERIFY_METHOD_LABELS: Record<string, string> = {
  institution_email: "School email address",
  student_id: "Student or staff ID number",
  document: "Upload a document (ID card, admission letter)",
  manual: "Ask the school's admins to confirm",
};

/** "University of Lagos (UNILAG)". */
export const schoolName = (i: { name: string; short_name?: string }) =>
  i.short_name && i.short_name !== i.name ? `${i.name} (${i.short_name})` : i.name;

export const schoolKeys = {
  list: (filters: object) => ["schools", filters] as const,
  detail: (id: string) => ["school", id] as const,
  part: (id: string, part: string) => ["school", id, part] as const,
  mine: ["myMemberships"] as const,
  verifications: (membershipId: string) => ["verifications", membershipId] as const,
  members: (id: string, filters: object) => ["school", id, "members", filters] as const,
  permissions: (scopeType: string, scopeId: string) => ["permissions", scopeType, scopeId] as const,
};

export interface SchoolFilters {
  q?: string;
  type?: string;
  page?: number;
}

export function useInstitutions(filters: SchoolFilters = {}) {
  return useQuery({
    queryKey: schoolKeys.list(filters),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<Institution>(
        await unwrap(
          api.GET("/api/v1/institutions/", {
            params: {
              query: {
                q: filters.q || undefined,
                type: filters.type || undefined,
                page: filters.page,
                country: "NG",
                page_size: 24,
              },
            },
          }),
        ),
      ),
  });
}

export function useInstitutionTypes() {
  return useQuery({
    queryKey: ["institutionTypes"],
    staleTime: Infinity,
    queryFn: () => unwrap(api.GET("/api/v1/institution-types/")),
  });
}

export function useInstitution(id: string | undefined) {
  return useQuery({
    queryKey: schoolKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: () =>
      unwrap(api.GET("/api/v1/institutions/{institution_id}/", { params: { path: { institution_id: id! } } })),
  });
}

/** A school's structure: campuses, faculties/departments, programmes, levels, sessions, email domains. */
export function useSchoolPart<T>(
  id: string | undefined,
  part: "campuses" | "units" | "programmes" | "levels" | "sessions" | "domains",
  enabled = true,
) {
  return useQuery({
    queryKey: schoolKeys.part(id ?? "", part),
    enabled: Boolean(id) && enabled,
    queryFn: async () => {
      const path = { params: { path: { institution_id: id! } } };
      const calls = {
        campuses: () => api.GET("/api/v1/institutions/{institution_id}/campuses/", path),
        units: () => api.GET("/api/v1/institutions/{institution_id}/units/", path),
        programmes: () => api.GET("/api/v1/institutions/{institution_id}/programmes/", path),
        levels: () => api.GET("/api/v1/institutions/{institution_id}/levels/", path),
        sessions: () => api.GET("/api/v1/institutions/{institution_id}/sessions/", path),
        domains: () => api.GET("/api/v1/institutions/{institution_id}/domains/", path),
      };
      return asPage<T>(await unwrap(calls[part]() as Promise<{ data?: unknown; response: Response }>)).results;
    },
  });
}

// ------------------------------------------------------------------ your schools
export function useMyMemberships(enabled = true) {
  return useQuery({
    queryKey: schoolKeys.mine,
    enabled,
    queryFn: async () => asPage<Membership>(await unwrap(api.GET("/api/v1/me/memberships/"))).results,
  });
}

function useMembershipMutation<A, R>(fn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: schoolKeys.mine });
      void queryClient.invalidateQueries({ queryKey: ["verifications"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export const useJoinInstitution = () =>
  useMembershipMutation((body: S["MembershipRequestRequest"]) => unwrap(api.POST("/api/v1/me/memberships/", { body })));

export const useUpdateMembership = () =>
  useMembershipMutation(({ id, body }: { id: string; body: S["PatchedMembershipUpdateRequest"] }) =>
    unwrap(api.PATCH("/api/v1/me/memberships/{membership_id}/", { params: { path: { membership_id: id } }, body })),
  );

export const useLeaveInstitution = () =>
  useMembershipMutation((id: string) =>
    unwrap(api.DELETE("/api/v1/me/memberships/{membership_id}/", { params: { path: { membership_id: id } } })),
  );

export const useMakePrimary = () =>
  useMembershipMutation((id: string) =>
    unwrap(api.POST("/api/v1/me/memberships/{membership_id}/primary/", { params: { path: { membership_id: id } } })),
  );

export function useVerifications(membershipId: string | undefined) {
  return useQuery({
    queryKey: schoolKeys.verifications(membershipId ?? ""),
    enabled: Boolean(membershipId),
    queryFn: async () =>
      asPage<Verification>(
        await unwrap(
          api.GET("/api/v1/me/memberships/{membership_id}/verifications/", {
            params: { path: { membership_id: membershipId! } },
          }),
        ),
      ).results,
  });
}

export interface StartVerification {
  method: string;
  email?: string;
  identifier?: string;
  note?: string;
  document?: File;
}

export const useStartVerification = (membershipId: string) =>
  useMembershipMutation(async ({ document, ...fields }: StartVerification) => {
    const path = `/api/v1/me/memberships/${membershipId}/verifications/`;
    if (document) {
      const extra = Object.fromEntries(Object.entries(fields).filter(([, v]) => v)) as Record<string, string>;
      return uploadFile<Verification>(path, document, extra, "document");
    }
    return unwrap(
      api.POST("/api/v1/me/memberships/{membership_id}/verifications/", {
        params: { path: { membership_id: membershipId } },
        body: fields,
      }),
    );
  });

export const useCompleteVerification = (membershipId: string) =>
  useMembershipMutation(({ verificationId, code }: { verificationId: string; code: string }) =>
    unwrap(
      api.POST("/api/v1/me/memberships/{membership_id}/verifications/{verification_id}/complete/", {
        params: { path: { membership_id: membershipId, verification_id: verificationId } },
        body: { code },
      }),
    ),
  );

// ---------------------------------------------------------------- announcements
export function useSchoolAnnouncements(id: string | undefined, status?: string) {
  return useQuery({
    queryKey: [...schoolKeys.part(id ?? "", "announcements"), status ?? ""],
    enabled: Boolean(id),
    queryFn: async () =>
      asPage<Announcement>(
        await unwrap(
          api.GET("/api/v1/institutions/{institution_id}/announcements/", {
            params: { path: { institution_id: id! }, query: { status: status || undefined } },
          }),
        ),
      ).results,
  });
}

function useSchoolMutation<A, R>(id: string, fn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["school", id] });
      void queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export const useSaveAnnouncement = (id: string) =>
  useSchoolMutation(id, ({ announcementId, body }: { announcementId?: string; body: AnnouncementWrite }) =>
    announcementId
      ? unwrap(
          api.PATCH("/api/v1/institutions/{institution_id}/announcements/{announcement_id}/", {
            params: { path: { institution_id: id, announcement_id: announcementId } },
            body,
          }),
        )
      : unwrap(
          api.POST("/api/v1/institutions/{institution_id}/announcements/", {
            params: { path: { institution_id: id } },
            body,
          }),
        ),
  );

export const useAnnouncementAction = (id: string) =>
  useSchoolMutation(
    id,
    ({ announcementId, action }: { announcementId: string; action: "publish" | "archive" | "delete" }) => {
      const path = { params: { path: { institution_id: id, announcement_id: announcementId } } };
      if (action === "delete")
        return unwrap(api.DELETE("/api/v1/institutions/{institution_id}/announcements/{announcement_id}/", path));
      if (action === "publish")
        return unwrap(api.POST("/api/v1/institutions/{institution_id}/announcements/{announcement_id}/publish/", path));
      return unwrap(api.POST("/api/v1/institutions/{institution_id}/announcements/{announcement_id}/archive/", path));
    },
  );

// -------------------------------------------------------------- running a school
export function useSchoolMembers(id: string | undefined, filters: { status?: string; role?: string; page?: number }) {
  return useQuery({
    queryKey: schoolKeys.members(id ?? "", filters),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      asPage<Member>(
        await unwrap(
          api.GET("/api/v1/institutions/{institution_id}/memberships/", {
            params: {
              path: { institution_id: id! },
              query: { status: filters.status || undefined, role: filters.role || undefined, page: filters.page },
            },
          }),
        ),
      ),
  });
}

export type MemberAction = "approve" | "reject" | "suspend" | "revoke";

export const useReviewMember = (id: string) =>
  useSchoolMutation(
    id,
    ({ membershipId, action, reason }: { membershipId: string; action: MemberAction; reason?: string }) => {
      const args = {
        params: { path: { institution_id: id, membership_id: membershipId } },
        body: reason ? { reason } : {},
      };
      switch (action) {
        case "approve":
          return unwrap(api.POST("/api/v1/institutions/{institution_id}/memberships/{membership_id}/approve/", args));
        case "reject":
          return unwrap(api.POST("/api/v1/institutions/{institution_id}/memberships/{membership_id}/reject/", args));
        case "suspend":
          return unwrap(api.POST("/api/v1/institutions/{institution_id}/memberships/{membership_id}/suspend/", args));
        default:
          return unwrap(api.POST("/api/v1/institutions/{institution_id}/memberships/{membership_id}/revoke/", args));
      }
    },
  );

/** Open a member's verification document (served only to the school's reviewers). */
export async function openVerificationDocument(id: string, membershipId: string, verificationId: string) {
  const { authFetch } = await import("../client");
  const response = await authFetch(
    new Request(
      new URL(
        `/api/v1/institutions/${id}/memberships/${membershipId}/verifications/${verificationId}/document/`,
        window.location.origin,
      ),
    ),
  );
  if (!response.ok) throw new UserFacingError("Couldn't open the document.");
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const useUpdateInstitution = (id: string) =>
  useSchoolMutation(id, (body: S["PatchedInstitutionRequest"]) =>
    unwrap(api.PATCH("/api/v1/institutions/{institution_id}/", { params: { path: { institution_id: id } }, body })),
  );

export const useCreateInstitution = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: S["InstitutionRequest"]) => unwrap(api.POST("/api/v1/institutions/", { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schools"] }),
  });
};

export type StructureKind = "campuses" | "units" | "programmes" | "levels" | "sessions" | "domains";

export const useAddStructure = (id: string) =>
  useSchoolMutation(id, ({ kind, body }: { kind: StructureKind; body: Record<string, unknown> }): Promise<unknown> => {
    const path = { params: { path: { institution_id: id } } };
    switch (kind) {
      case "campuses":
        return unwrap(
          api.POST("/api/v1/institutions/{institution_id}/campuses/", { ...path, body: body as S["CampusRequest"] }),
        );
      case "units":
        return unwrap(
          api.POST("/api/v1/institutions/{institution_id}/units/", { ...path, body: body as S["AcademicUnitRequest"] }),
        );
      case "programmes":
        return unwrap(
          api.POST("/api/v1/institutions/{institution_id}/programmes/", {
            ...path,
            body: body as S["ProgrammeRequest"],
          }),
        );
      case "levels":
        return unwrap(
          api.POST("/api/v1/institutions/{institution_id}/levels/", { ...path, body: body as S["LevelRequest"] }),
        );
      case "sessions":
        return unwrap(
          api.POST("/api/v1/institutions/{institution_id}/sessions/", {
            ...path,
            body: body as S["AcademicSessionRequest"],
          }),
        );
      default:
        return unwrap(
          api.POST("/api/v1/institutions/{institution_id}/domains/", { ...path, body: body as S["DomainRequest"] }),
        );
    }
  });

/** Edit a campus, unit, programme or level (the API's generic per-object endpoint). */
export const useEditStructure = (id: string) =>
  useSchoolMutation(id, ({ kind, objectId, body }: { kind: string; objectId: string; body: Record<string, unknown> }) =>
    unwrap(
      api.PATCH("/api/v1/institutions/{institution_id}/{kind}/{object_id}/", {
        params: { path: { institution_id: id, kind, object_id: objectId } },
        body,
      }),
    ),
  );

export const useAddSemester = (id: string) =>
  useSchoolMutation(id, ({ sessionId, body }: { sessionId: string; body: S["SemesterRequest"] }) =>
    unwrap(
      api.POST("/api/v1/institutions/{institution_id}/sessions/{session_id}/semesters/", {
        params: { path: { institution_id: id, session_id: sessionId } },
        body,
      }),
    ),
  );

export const useRemoveDomain = (id: string) =>
  useSchoolMutation(id, (domainId: string) =>
    unwrap(
      api.DELETE("/api/v1/institutions/{institution_id}/domains/{domain_id}/", {
        params: { path: { institution_id: id, domain_id: domainId } },
      }),
    ),
  );

// ------------------------------------------------------------------ permissions
/** What the signed-in person may do in a scope (a school, a community, the whole platform). */
export function usePermissions(scopeType = "platform", scopeId = "", enabled = true) {
  return useQuery({
    queryKey: schoolKeys.permissions(scopeType, scopeId),
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await request<{ permissions: string[] }>("GET", "/api/v1/me/permissions/", {
        query: { scope_type: scopeType, scope_id: scopeId || undefined },
      });
      return new Set(data.permissions);
    },
  });
}

/** Whether ``perms`` grants ``code`` (patterns such as ``institution.*`` included). */
export function can(perms: Set<string> | undefined, code: string): boolean {
  if (!perms) return false;
  if (perms.has("*") || perms.has(code)) return true;
  return [...perms].some((p) => p.endsWith(".*") && code.startsWith(p.slice(0, -1)));
}
