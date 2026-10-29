import { describe, expect, it } from "vitest";

import { checkImage } from "./upload";

const file = (type: string, bytes: number) => new File([new Uint8Array(bytes)], "x", { type });

describe("checkImage", () => {
  it("accepts JPEG, PNG and WebP under the limit", () => {
    expect(checkImage(file("image/jpeg", 10), 5)).toBeNull();
    expect(checkImage(file("image/png", 10), 5)).toBeNull();
    expect(checkImage(file("image/webp", 10), 5)).toBeNull();
  });

  it("rejects other types and oversized files with a clear message", () => {
    expect(checkImage(file("image/gif", 10), 5)).toMatch(/JPEG, PNG or WebP/);
    expect(checkImage(file("application/pdf", 10), 5)).toMatch(/JPEG, PNG or WebP/);
    expect(checkImage(file("image/png", 6 * 1024 * 1024), 5)).toMatch(/under 5 MB/);
  });
});
