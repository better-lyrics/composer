import { describe, expect, it } from "vitest";
import { agentsAfterImport } from "@/domain/agent/imported-agents";
import type { Agent } from "@/domain/agent/model";

// -- Fixtures -----------------------------------------------------------------

const LEAD: Agent = { id: "v1", type: "person", name: "Lead" };
const BOB: Agent = { id: "v2", type: "person", name: "Bob" };
const CARA: Agent = { id: "v3", type: "person", name: "Cara" };

function line(agentId: string, text = "Hello") {
  return { text, agentId };
}

// -- Tests --------------------------------------------------------------------

describe("agentsAfterImport", () => {
  it("keeps the existing singers the imported lines reference", () => {
    const result = agentsAfterImport([LEAD, BOB], undefined, [line("v1")]);
    expect(result).toEqual({ agents: [LEAD], lines: [line("v1")] });
  });

  it("adds the singers the import declares", () => {
    const result = agentsAfterImport([LEAD], [CARA], [line("v1"), line("v3")]);
    expect(result.agents).toEqual([LEAD, CARA]);
  });

  it("renames an existing singer the import declares again", () => {
    const result = agentsAfterImport([LEAD], [{ id: "v1", type: "group", name: "Everyone" }], [line("v1")]);
    expect(result.agents).toEqual([{ id: "v1", type: "group", name: "Everyone" }]);
  });

  it("drops a singer from a previous import that no imported line references", () => {
    const result = agentsAfterImport([LEAD, BOB], [LEAD], [line("v1")]);
    expect(result.agents).toEqual([LEAD]);
  });

  it("gives lyrics without singers the first singer of the project", () => {
    const result = agentsAfterImport([BOB, CARA], undefined, [line("v1", "A"), line("v1", "B")]);
    expect(result.lines).toEqual([line("v2", "A"), line("v2", "B")]);
    expect(result.agents).toEqual([BOB]);
  });

  describe("edge cases", () => {
    it("treats an empty singer list like a parse without singers", () => {
      const result = agentsAfterImport([BOB], [], [line("v1")]);
      expect(result).toEqual({ agents: [BOB], lines: [line("v2")] });
    });

    it("falls back to v1 only when the project has no singers", () => {
      const result = agentsAfterImport([], undefined, [line("v7")]);
      expect(result.lines).toEqual([line("v1")]);
    });

    it("keeps a line that already references an existing singer", () => {
      const result = agentsAfterImport([LEAD, BOB], undefined, [line("v2"), line("v9")]);
      expect(result.lines).toEqual([line("v2"), line("v1")]);
      expect(result.agents).toEqual([LEAD, BOB]);
    });

    it("leaves the lines of an import that declares singers alone", () => {
      const result = agentsAfterImport([LEAD], [CARA], [line("v3")]);
      expect(result.lines).toEqual([line("v3")]);
    });

    it("handles an import with no lines", () => {
      const result = agentsAfterImport([LEAD], undefined, []);
      expect(result).toEqual({ agents: [LEAD], lines: [] });
    });
  });

  describe("invariants", () => {
    it("never leaves the project without a singer when it had one", () => {
      const result = agentsAfterImport([LEAD], [], [line("v9")]);
      expect(result.agents.length).toBeGreaterThan(0);
    });

    it("every imported line references a singer in the result when the project had singers", () => {
      const result = agentsAfterImport([BOB], [CARA], [line("v3"), line("v2")]);
      const ids = new Set(result.agents.map((agent) => agent.id));
      for (const imported of result.lines) expect(ids.has(imported.agentId)).toBe(true);
    });

    it("does not mutate its inputs", () => {
      const existing = [LEAD, BOB];
      const lines = [line("v9")];
      agentsAfterImport(existing, undefined, lines);
      expect(existing).toEqual([LEAD, BOB]);
      expect(lines).toEqual([line("v9")]);
    });

    it("returns the same line objects when nothing is reassigned", () => {
      const lines = [line("v1")];
      expect(agentsAfterImport([LEAD], undefined, lines).lines[0]).toBe(lines[0]);
    });
  });
});
