/** Two-step verification, phone, linked sign-in providers, API keys, activity, consents, push devices. */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { oauthProviders } from "../auth";
import { api, unwrap } from "../client";
import type { components } from "../schema";
import { asPage, nextParam } from "../types";

type S = components["schemas"];
export type SecuritySettings = S["SecuritySettings"];
export type LinkedIdentity = S["ExternalIdentity"];
export type ApiKey = S["APIKey"];
export type ApiKeyCreated = S["APIKeyCreated"];
export type Activity = S["Activity"];
export type PushDevice = S["PushDevice"];

/** Google, Yahoo, GitHub: the sign-in providers this site has keys for. */
export function useOAuthProviders() {
  return useQuery({ queryKey: ["oauthProviders"], staleTime: Infinity, queryFn: oauthProviders });
}

export const securityKeys = {
  settings: ["securitySettings"] as const,
  identities: ["identities"] as const,
  apiKeys: ["apiKeys"] as const,
  activity: ["activity"] as const,
  consents: ["consents"] as const,
  devices: ["pushDevices"] as const,
};

function useInvalidating<A, R>(fn: (arg: A) => Promise<R>, ...keys: (readonly unknown[])[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of keys) void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useSecuritySettings() {
  return useQuery({ queryKey: securityKeys.settings, queryFn: () => unwrap(api.GET("/api/v1/me/security/")) });
}

export const useUpdateSecuritySettings = () =>
  useInvalidating(
    (body: S["PatchedSecuritySettingsRequest"]) => unwrap(api.PATCH("/api/v1/me/security/", { body })),
    securityKeys.settings,
  );

// ------------------------------------------------------------- two-step sign-in
export const useStartMfa = () =>
  useInvalidating((channel: "email" | "sms") => unwrap(api.POST("/api/v1/me/mfa/enrol/", { body: { channel } })));

export const useConfirmMfa = () =>
  useInvalidating(
    (body: S["MFAConfirmRequest"]) => unwrap(api.POST("/api/v1/me/mfa/confirm/", { body })),
    securityKeys.settings,
    ["me"],
  );

export const useDisableMfa = () =>
  useInvalidating(
    (password: string) => unwrap(api.POST("/api/v1/me/mfa/disable/", { body: { password } })),
    securityKeys.settings,
    ["me"],
  );

// ------------------------------------------------------------------- phone number
export const useStartPhone = () =>
  useInvalidating((phone_number: string) => unwrap(api.POST("/api/v1/me/phone/", { body: { phone_number } })));

export const useConfirmPhone = () =>
  useInvalidating((body: S["PhoneConfirmRequest"]) => unwrap(api.POST("/api/v1/me/phone/verify/", { body })), ["me"]);

export const useRemovePhone = () => useInvalidating(() => unwrap(api.DELETE("/api/v1/me/phone/")), ["me"]);

// ------------------------------------------------------------- linked providers
export function useLinkedIdentities() {
  return useQuery({
    queryKey: securityKeys.identities,
    queryFn: async () => asPage<LinkedIdentity>(await unwrap(api.GET("/api/v1/me/identities/"))).results,
  });
}

export const useUnlinkIdentity = () =>
  useInvalidating(
    (id: string) =>
      unwrap(api.DELETE("/api/v1/me/identities/{identity_id}/", { params: { path: { identity_id: id } } })),
    securityKeys.identities,
  );

// ----------------------------------------------------------------------- API keys
export function useApiKeys() {
  return useQuery({
    queryKey: securityKeys.apiKeys,
    queryFn: async () => asPage<ApiKey>(await unwrap(api.GET("/api/v1/me/api-keys/"))).results,
  });
}

export const useCreateApiKey = () =>
  useInvalidating(
    (body: S["APIKeyCreateRequest"]) => unwrap(api.POST("/api/v1/me/api-keys/", { body })),
    securityKeys.apiKeys,
  );

export const useRevokeApiKey = () =>
  useInvalidating(
    (id: string) => unwrap(api.DELETE("/api/v1/me/api-keys/{api_key_id}/", { params: { path: { api_key_id: id } } })),
    securityKeys.apiKeys,
  );

// ----------------------------------------------------------------------- activity
export function useActivity() {
  return useInfiniteQuery({
    queryKey: securityKeys.activity,
    initialPageParam: "",
    queryFn: async ({ pageParam }) =>
      unwrap(api.GET("/api/v1/me/activity/", { params: { query: { cursor: pageParam || undefined, page_size: 25 } } })),
    getNextPageParam: (last) => nextParam(last.next ?? null, "cursor"),
  });
}

// ----------------------------------------------------------------------- consents
export type ConsentState = Record<string, { granted: boolean; version: string; recorded_at: string }>;

export function useConsents() {
  return useQuery({
    queryKey: securityKeys.consents,
    queryFn: async () => (await unwrap(api.GET("/api/v1/me/consents/"))) as ConsentState,
  });
}

export const useSetConsent = () =>
  useInvalidating(
    (body: S["ConsentRequest"]) => unwrap(api.POST("/api/v1/me/consents/", { body })),
    securityKeys.consents,
  );

// ------------------------------------------------------------------ push devices
export function usePushDevices() {
  return useQuery({
    queryKey: securityKeys.devices,
    queryFn: async () => asPage<PushDevice>(await unwrap(api.GET("/api/v1/notifications/devices/"))).results,
  });
}

export const useRegisterPushDevice = () =>
  useInvalidating(
    (body: S["PushDeviceRegisterRequest"]) => unwrap(api.POST("/api/v1/notifications/devices/", { body })),
    securityKeys.devices,
  );

export const useRemovePushDevice = () =>
  useInvalidating(
    (id: string) =>
      unwrap(api.DELETE("/api/v1/notifications/devices/{device_id}/", { params: { path: { device_id: id } } })),
    securityKeys.devices,
  );

export const useUnregisterPushToken = () =>
  useInvalidating(
    (token: string) => unwrap(api.POST("/api/v1/notifications/devices/unregister/", { body: { token } })),
    securityKeys.devices,
  );
