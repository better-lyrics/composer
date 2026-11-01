import { PROJECT_TABS, isProjectTab } from "@/domain/project/tab";
import { describe, expect, it } from "vitest";

describe("isProjectTab", () => {
  it("accepts every editor tab", () => {
    for (const tab of PROJECT_TABS) expect(isProjectTab(tab)).toBe(true);
  });

  describe("edge cases", () => {
    it("rejects unknown strings, other types and near misses", () => {
      expect(isProjectTab("library")).toBe(false);
      expect(isProjectTab("Sync")).toBe(false);
      expect(isProjectTab("")).toBe(false);
      expect(isProjectTab(undefined)).toBe(false);
      expect(isProjectTab(3)).toBe(false);
    });
  });

  describe("invariants", () => {
    it("lists the tabs in tab bar order with no duplicates", () => {
      expect(PROJECT_TABS).toEqual(["import", "edit", "languages", "sync", "timeline", "preview", "export"]);
      expect(new Set(PROJECT_TABS).size).toBe(PROJECT_TABS.length);
    });
  });
});
