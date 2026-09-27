/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from "vitest";
import { INITIAL_STATE, useProjectStore } from "@/stores/project";

const LINE_SYNCED = { id: "ls", text: "Line synced only", agentId: "v1", begin: 17, end: 20 };
const WORD_SYNCED = { id: "w", text: "hi", agentId: "v1", words: [{ text: "hi", begin: 0, end: 1 }] };

describe("project store · insertEmptyLineWithHistory", () => {
  beforeEach(() => useProjectStore.setState(INITIAL_STATE));

  describe("happy paths", () => {
    it("inserts an empty line below the anchor", () => {
      useProjectStore.setState({ lines: [WORD_SYNCED, LINE_SYNCED] });
      useProjectStore.getState().insertEmptyLineWithHistory("w", "below");
      const after = useProjectStore.getState().lines;
      expect(after.map((l) => l.id)[0]).toBe("w");
      expect(after[1]).toMatchObject({ text: "", agentId: "v1" });
      expect(after[2].id).toBe("ls");
    });

    it("inserts an empty line above the anchor", () => {
      useProjectStore.setState({ lines: [WORD_SYNCED, LINE_SYNCED] });
      useProjectStore.getState().insertEmptyLineWithHistory("ls", "above");
      const after = useProjectStore.getState().lines;
      expect(after[0].id).toBe("w");
      expect(after[1]).toMatchObject({ text: "", agentId: "v1" });
      expect(after[2].id).toBe("ls");
    });

    it("uses the first agent as the default agent", () => {
      useProjectStore.setState({
        lines: [WORD_SYNCED],
        agents: [
          { id: "v7", name: "Seven", type: "person" },
          { id: "v1", name: "One", type: "person" },
        ],
      });
      useProjectStore.getState().insertEmptyLineWithHistory("w", "below");
      expect(useProjectStore.getState().lines[1].agentId).toBe("v7");
    });
  });

  describe("edge cases", () => {
    it("falls back to v1 when there are no agents", () => {
      useProjectStore.setState({ lines: [WORD_SYNCED], agents: [] });
      useProjectStore.getState().insertEmptyLineWithHistory("w", "above");
      expect(useProjectStore.getState().lines[0].agentId).toBe("v1");
    });

    it("does nothing when the anchor is missing", () => {
      const lines = [WORD_SYNCED];
      useProjectStore.setState({ lines });
      useProjectStore.getState().insertEmptyLineWithHistory("missing", "below");
      expect(useProjectStore.getState().lines).toBe(lines);
    });
  });

  describe("invariants", () => {
    it("regression N: leaves line-synced rows line-synced", () => {
      useProjectStore.setState({ lines: [WORD_SYNCED, LINE_SYNCED] });
      useProjectStore.getState().insertEmptyLineWithHistory("w", "below");
      expect(useProjectStore.getState().lines.find((l) => l.id === "ls")).toEqual(LINE_SYNCED);
    });

    it("is undoable in one step", () => {
      useProjectStore.setState({ lines: [WORD_SYNCED] });
      useProjectStore.getState().insertEmptyLineWithHistory("w", "below");
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().lines).toEqual([WORD_SYNCED]);
    });
  });
});
