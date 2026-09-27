import { PREVIEW_SIDEBAR_WIDTH, clampPreviewSidebarWidth } from "@/utils/preview-sidebar-width";
import { describe, expect, it } from "vitest";

describe("clampPreviewSidebarWidth", () => {
  it("keeps a width inside the bounds", () => {
    expect(clampPreviewSidebarWidth(400)).toBe(400);
  });

  it("rounds to whole pixels", () => {
    expect(clampPreviewSidebarWidth(400.6)).toBe(401);
  });

  describe("edge cases", () => {
    it("raises a width below the minimum to the minimum", () => {
      expect(clampPreviewSidebarWidth(10)).toBe(PREVIEW_SIDEBAR_WIDTH.min);
      expect(clampPreviewSidebarWidth(-500)).toBe(PREVIEW_SIDEBAR_WIDTH.min);
    });

    it("lowers a width above the maximum to the maximum", () => {
      expect(clampPreviewSidebarWidth(5000)).toBe(PREVIEW_SIDEBAR_WIDTH.max);
    });

    it("keeps both bounds themselves", () => {
      expect(clampPreviewSidebarWidth(PREVIEW_SIDEBAR_WIDTH.min)).toBe(PREVIEW_SIDEBAR_WIDTH.min);
      expect(clampPreviewSidebarWidth(PREVIEW_SIDEBAR_WIDTH.max)).toBe(PREVIEW_SIDEBAR_WIDTH.max);
    });

    it("falls back to the default for a width that is not a finite number", () => {
      expect(clampPreviewSidebarWidth(Number.NaN)).toBe(PREVIEW_SIDEBAR_WIDTH.default);
      expect(clampPreviewSidebarWidth(Number.POSITIVE_INFINITY)).toBe(PREVIEW_SIDEBAR_WIDTH.default);
      expect(clampPreviewSidebarWidth(Number.NEGATIVE_INFINITY)).toBe(PREVIEW_SIDEBAR_WIDTH.default);
    });
  });

  describe("invariants", () => {
    it("orders the bounds with the default between them", () => {
      expect(PREVIEW_SIDEBAR_WIDTH.min).toBeLessThan(PREVIEW_SIDEBAR_WIDTH.default);
      expect(PREVIEW_SIDEBAR_WIDTH.default).toBeLessThan(PREVIEW_SIDEBAR_WIDTH.max);
    });

    it("is idempotent", () => {
      for (const width of [-1, 0, 239.5, 320, 641, 9999]) {
        const once = clampPreviewSidebarWidth(width);
        expect(clampPreviewSidebarWidth(once)).toBe(once);
      }
    });
  });
});
