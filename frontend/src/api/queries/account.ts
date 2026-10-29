import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { type Me, type ProfileExtras, type PublicProfile, asPage } from "../types";
import { uploadFile } from "../upload";
import type { components } from "../schema";

type S = components["schemas"];

export const accountKeys = {
  me: ["me"] as const,
  socialProfile: ["socialProfile"] as const,
  profile: (handle: string) => ["profile", handle] as const,
  privacy: ["privacy"] as const,
  notificationSettings: ["notificationSettings"] as const,
  notificationCategories: ["notificationCategories"] as const,
  sessions: ["sessions"] as const,
};

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.me,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: () => unwrap(api.GET("/api/v1/me/")),
  });
}

export function useProfile(handle: string | undefined) {
  return useQuery({
    queryKey: accountKeys.profile(handle ?? ""),
    enabled: Boolean(handle),
    queryFn: async () => {
      const profile = await unwrap(
        api.GET("/api/v1/users/by-handle/{handle}/", { params: { path: { handle: handle! } } }),
      );
      return profile as PublicProfile & { extras: ProfileExtras };
    },
  });
}

export function useSocialProfile(enabled = true) {
  return useQuery({
    queryKey: accountKeys.socialProfile,
    enabled,
    queryFn: () => unwrap(api.GET("/api/v1/social/me/profile/")),
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: S["PatchedMeRequest"]) => unwrap(api.PATCH("/api/v1/me/", { body })),
    onSuccess: (me) => {
      queryClient.setQueryData(accountKeys.me, me);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useUpdateSocialProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: S["PatchedSocialProfileRequest"]) => unwrap(api.PATCH("/api/v1/social/me/profile/", { body })),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountKeys.socialProfile, profile);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function usePrivacy() {
  return useQuery({ queryKey: accountKeys.privacy, queryFn: () => unwrap(api.GET("/api/v1/me/privacy/")) });
}

export function useUpdatePrivacy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: S["PatchedPrivacySettingsRequest"]) => unwrap(api.PATCH("/api/v1/me/privacy/", { body })),
    onSuccess: (data) => queryClient.setQueryData(accountKeys.privacy, data),
  });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: accountKeys.notificationSettings,
    queryFn: () => unwrap(api.GET("/api/v1/me/notifications/")),
  });
}

export function useNotificationCategories() {
  return useQuery({
    queryKey: accountKeys.notificationCategories,
    staleTime: 60 * 60_000,
    queryFn: async () =>
      asPage<S["NotificationCategory"]>(await unwrap(api.GET("/api/v1/notifications/categories/"))).results,
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: S["PatchedNotificationSettingsRequest"]) =>
      unwrap(api.PATCH("/api/v1/me/notifications/", { body })),
    onSuccess: (data) => queryClient.setQueryData(accountKeys.notificationSettings, data),
  });
}

export function useSessions() {
  return useQuery({
    queryKey: accountKeys.sessions,
    queryFn: async () => asPage<S["Session"]>(await unwrap(api.GET("/api/v1/me/sessions/"))).results,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      unwrap(api.DELETE("/api/v1/me/sessions/{session_id}/", { params: { path: { session_id: sessionId } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.sessions }),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/me/sessions/revoke-others/")),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.sessions }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: S["PasswordChangeRequest"]) => unwrap(api.POST("/api/v1/me/password/", { body })),
  });
}

export function useChangeEmail() {
  return useMutation({
    mutationFn: (body: S["EmailChangeRequest"]) => unwrap(api.POST("/api/v1/me/email/", { body })),
  });
}

/** Delete the account. The API asks for the password, so a stolen session alone can't do it. */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (password: string) => unwrap(api.DELETE("/api/v1/me/", { body: { password } })),
  });
}

/** Upload a profile photo. The API strips location data and re-encodes it. */
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile<Me>("/api/v1/me/avatar/", file),
    onSuccess: (me) => {
      queryClient.setQueryData(accountKeys.me, me);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.DELETE("/api/v1/me/avatar/")),
    onSuccess: (me) => {
      queryClient.setQueryData(accountKeys.me, me);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/** Download a copy of the account's data as a JSON file. */
export async function downloadMyData(): Promise<void> {
  const data = await unwrap(api.GET("/api/v1/me/export/"));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: "gistloop-my-data.json" });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ------------------------------------------------------------------ public account flows
export function useRegister() {
  return useMutation({
    mutationFn: (body: S["RegisterRequest"]) => unwrap(api.POST("/api/v1/auth/register/", { body })),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => unwrap(api.POST("/api/v1/auth/email/verify/", { body: { token } })),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => unwrap(api.POST("/api/v1/auth/email/verify/resend/", { body: { email } })),
  });
}

export function useConfirmEmailChange() {
  return useMutation({
    mutationFn: (token: string) => unwrap(api.POST("/api/v1/auth/email/change/confirm/", { body: { token } })),
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => unwrap(api.POST("/api/v1/auth/password/reset/", { body: { email } })),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: S["PasswordResetConfirmRequest"]) =>
      unwrap(api.POST("/api/v1/auth/password/reset/confirm/", { body })),
  });
}
