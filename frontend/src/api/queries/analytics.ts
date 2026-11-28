/** Aggregate analytics (counts per day) and view counting. */
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { api, unwrap } from "../client";
import { request } from "../http";

export interface AnalyticsReport {
  from: string;
  to: string;
  scope: { type: string; id: string } | null;
  /** Counts below this are hidden inside a scope (they could identify people). */
  suppression_threshold: number | null;
  metrics: { metric: string; total: number | null; series: { date: string; value: number | null }[] }[];
}

export interface Range {
  from?: string;
  to?: string;
}

/** Platform-wide numbers (staff with analytics.view). */
export function usePlatformAnalytics(range: Range, enabled = true) {
  return useQuery({
    queryKey: ["analytics", "platform", range],
    enabled,
    queryFn: async () =>
      (await request<AnalyticsReport>("GET", "/api/v1/analytics/overview/", {
        query: { from: range.from, to: range.to },
      })) as AnalyticsReport,
  });
}

/** A community's or a school's numbers (its admins). */
export function useScopeAnalytics(scopeType: string, scopeId: string | undefined, range: Range, enabled = true) {
  return useQuery({
    queryKey: ["analytics", scopeType, scopeId, range],
    enabled: enabled && Boolean(scopeId),
    queryFn: () =>
      request<AnalyticsReport>("GET", `/api/v1/analytics/scopes/${scopeType}/${scopeId}/`, {
        query: { from: range.from, to: range.to },
      }),
  });
}

/** Your creator numbers. */
export function useCreatorAnalytics(range: Range, enabled = true) {
  return useQuery({
    queryKey: ["analytics", "creator", range],
    enabled,
    queryFn: () =>
      request<AnalyticsReport>("GET", "/api/v1/me/creator/analytics/", { query: { from: range.from, to: range.to } }),
  });
}

export function useKnownMetrics(enabled = true) {
  return useQuery({
    queryKey: ["analytics", "metrics"],
    enabled,
    queryFn: () => unwrap(api.GET("/api/v1/analytics/metrics/")),
  });
}

const counted = new Set<string>();

/** Count one view of a piece of content per page load (the API also de-duplicates). */
export function useRecordView(contentType: string, objectId: string | undefined) {
  useEffect(() => {
    if (!objectId) return;
    const key = `${contentType}:${objectId}`;
    if (counted.has(key)) return;
    counted.add(key);
    void unwrap(
      api.POST("/api/v1/analytics/views/", { body: { content_type: contentType, object_id: objectId } }),
    ).catch(() => undefined);
  }, [contentType, objectId]);
}
