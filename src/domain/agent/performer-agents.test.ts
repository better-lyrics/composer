import { isGroupPerformerName } from "@/domain/agent/performer-agents";
import { describe, expect, it } from "vitest";

describe("isGroupPerformerName", () => {
  it("reads the names QQ writes for the whole cast", () => {
    expect(isGroupPerformerName("合")).toBe(true);
    expect(isGroupPerformerName("合唱")).toBe(true);
    expect(isGroupPerformerName("ALL")).toBe(true);
  });

  describe("edge cases", () => {
    it("reads the name whatever its case", () => {
      expect(isGroupPerformerName("all")).toBe(true);
      expect(isGroupPerformerName("All")).toBe(true);
      expect(isGroupPerformerName("aLL")).toBe(true);
    });

    it("does not read a name that merely starts with one", () => {
      expect(isGroupPerformerName("Allison")).toBe(false);
      expect(isGroupPerformerName("合唱团")).toBe(false);
    });

    it("does not read an ordinary performer name", () => {
      expect(isGroupPerformerName("Drake")).toBe(false);
      expect(isGroupPerformerName("周杰倫")).toBe(false);
      expect(isGroupPerformerName("")).toBe(false);
    });
  });
});
