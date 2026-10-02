import { DEFAULT_EXPORT_TIMING, savedExportTiming } from "@/domain/project/export-timing";
import { describe, expect, it } from "vitest";

describe("savedExportTiming", () => {
  describe("happy paths", () => {
    it("keeps a saved line or word choice", () => {
      expect(savedExportTiming("line")).toBe("line");
      expect(savedExportTiming("word")).toBe("word");
    });
  });

  describe("edge cases", () => {
    it("falls back to the default for a project saved before the choice existed", () => {
      expect(savedExportTiming(undefined)).toBe(DEFAULT_EXPORT_TIMING);
    });
  });

  describe("error paths", () => {
    it.each(["Line", "", "syllable", 1, null, {}])("falls back to the default for %j from a hand-edited file", (value) => {
      expect(savedExportTiming(value)).toBe(DEFAULT_EXPORT_TIMING);
    });
  });

  describe("invariants", () => {
    it("defaults to word so an old project exports the way it always did", () => {
      expect(DEFAULT_EXPORT_TIMING).toBe("word");
    });
  });
});
