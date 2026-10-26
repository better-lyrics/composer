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
  it("numbers people from v1 and gives every group the one v1000 singer", () => {
    const performers = createPerformerAgents();
    const ids = [["Drake"], ["Drake", "Rihanna"], ["Rihanna"], ["合唱"], ["Rihanna", "Drake"]].map(
      (names) => performers.agentFor(names).id,
    );
    expect(ids).toEqual(["v1", "v1000", "v2", "v1000", "v1000"]);
    expect(performers.agents).toEqual([
      { id: "v1", type: "person", name: "Drake" },
      { id: "v1000", type: "group", name: "Chorus" },
      { id: "v2", type: "person", name: "Rihanna" },
    ]);
  });

  it("regression: a name with a slash is not read as two members", () => {
    const performers = createPerformerAgents();
    performers.agentFor(["AC/DC", "Foo"]);
    performers.agentFor(["AC", "DC", "Foo"]);
    expect(performers.agents).toEqual([{ id: "v1000", type: "group", name: "Chorus" }]);
  });

  it("keeps the name of the only group a song has", () => {
    const performers = createPerformerAgents();
    performers.agentFor(["Drake", "Rihanna"]);
    performers.agentFor(["rihanna", "drake"]);
    expect(performers.agents).toEqual([{ id: "v1000", type: "group", name: "Drake, Rihanna" }]);
  });
});
