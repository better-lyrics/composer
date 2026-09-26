import { describe, expect, it } from "vitest";
import { withDefaultAgentNames } from "@/domain/agent/default-names";
import type { Agent } from "@/domain/agent/model";

describe("withDefaultAgentNames", () => {
  it("restores the preset name on a renamed preset agent", () => {
    const agents: Agent[] = [{ id: "v1", type: "person", name: "April Harper Grey" }];
    expect(withDefaultAgentNames(agents)).toEqual([{ id: "v1", type: "person", name: "Lead" }]);
  });

  it("drops the custom name on a non-preset agent and keeps its id and type", () => {
    const agents: Agent[] = [{ id: "v2", type: "person", name: "Featured Singer" }];
    expect(withDefaultAgentNames(agents)).toEqual([{ id: "v2", type: "person" }]);
  });

  describe("edge cases", () => {
    it("returns an empty list unchanged", () => {
      expect(withDefaultAgentNames([])).toEqual([]);
    });

    it("leaves an unnamed non-preset agent as is", () => {
      expect(withDefaultAgentNames([{ id: "v3", type: "group" }])).toEqual([{ id: "v3", type: "group" }]);
    });
  });

  describe("invariants", () => {
    it("keeps every agent id in order so lines never lose their agent", () => {
      const agents: Agent[] = [
        { id: "v1", type: "person", name: "A" },
        { id: "v2", type: "person", name: "B" },
        { id: "v1000", type: "group", name: "C" },
      ];
      expect(withDefaultAgentNames(agents).map((a) => a.id)).toEqual(["v1", "v2", "v1000"]);
    });

    it("does not mutate the input", () => {
      const agents: Agent[] = [{ id: "v1", type: "person", name: "A" }];
      withDefaultAgentNames(agents);
      expect(agents).toEqual([{ id: "v1", type: "person", name: "A" }]);
    });
  });
});
