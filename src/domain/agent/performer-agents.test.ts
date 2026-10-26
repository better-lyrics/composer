import { createPerformerAgents, isGroupPerformerName } from "@/domain/agent/performer-agents";
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

describe("createPerformerAgents", () => {
  it("numbers people from v1 and groups from v1000, each in order of first appearance", () => {
    const performers = createPerformerAgents();
    const ids = [["Drake"], ["Drake", "Rihanna"], ["Rihanna"], ["合唱"], ["Rihanna", "Drake"]].map(
      (names) => performers.agentFor(names).id,
    );
    expect(ids).toEqual(["v1", "v1000", "v2", "v1001", "v1000"]);
    expect(performers.agents).toEqual([
      { id: "v1", type: "person", name: "Drake" },
      { id: "v1000", type: "group", name: "Drake, Rihanna" },
      { id: "v2", type: "person", name: "Rihanna" },
      { id: "v1001", type: "group", name: "合唱" },
    ]);
  });
});
