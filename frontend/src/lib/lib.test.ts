import { describe, expect, it } from "vitest";

import { safeNext } from "@/auth/guards";
import { brand } from "@/config/brand";

import { formatMoney, humanize, initials, timeAgo } from "./format";
import { contentHref, safeUrl } from "./links";

describe("formatting", () => {
  it("formats kobo as naira", () => {
    expect(formatMoney(850000)).toMatch(/8,500/);
    expect(formatMoney(850050)).toMatch(/8,500\.50/);
  });

  it("describes times relatively", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    expect(timeAgo("2026-10-28T11:59:50Z", now)).toBe("just now");
    expect(timeAgo("2026-10-28T11:00:00Z", now)).toMatch(/1 hr/);
  });

  it("makes initials and labels", () => {
    expect(initials("Amaka Eze")).toBe("AE");
    expect(initials("")).toBe("?");
    expect(humanize("in_person")).toBe("In person");
  });
});

describe("links", () => {
  it("only allows http(s) user links", () => {
    expect(safeUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
  });

  it("never redirects off-site after sign-in", () => {
    expect(safeNext("/events/hackathon")).toBe("/events/hackathon");
    expect(safeNext("https://evil.example")).toBe("/feed");
    expect(safeNext("//evil.example")).toBe("/feed");
    expect(safeNext("/\\evil.example")).toBe("/feed");
    expect(safeNext(null)).toBe("/feed");
  });

  it("maps content types to pages", () => {
    expect(contentHref("social.post", "p1")).toBe("/posts/p1");
    expect(contentHref("community.community", "c1")).toBe("/c/c1");
    expect(contentHref("unknown.type", "x")).toBeNull();
  });
});

describe("brand configuration", () => {
  const urls = (value: unknown): string[] =>
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.flatMap(urls)
        : value && typeof value === "object"
          ? Object.values(value).flatMap(urls)
          : [];

  it("serves every asset over HTTPS", () => {
    for (const url of urls(brand.assets)) expect(url).toMatch(/^https:\/\//);
  });

  it("uses valid hex colours", () => {
    expect(brand.colors.primary).toMatch(/^#[0-9a-f]{6}$/i);
    expect(brand.colors.accent).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
