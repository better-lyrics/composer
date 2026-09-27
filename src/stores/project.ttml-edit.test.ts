import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";

const EDIT = { source: "<tt>generated</tt>", content: "<tt>edited</tt>" };

describe("hand-edited TTML is project data", () => {
  it("starts with no edit", () => {
    expect(useProjectStore.getState().ttmlEditState).toBeNull();
  });

  it("stores an edit and marks the project dirty", () => {
    useProjectStore.getState().markClean();
    useProjectStore.getState().setTtmlEditState(EDIT);
    expect(useProjectStore.getState().ttmlEditState).toEqual(EDIT);
    expect(useProjectStore.getState().isDirty).toBe(true);
  });

  it("applies an updater to the current edit", () => {
    useProjectStore.getState().setTtmlEditState(EDIT);
    useProjectStore.getState().setTtmlEditState((prev) => (prev === null ? prev : { ...prev, content: "<tt>2</tt>" }));
    expect(useProjectStore.getState().ttmlEditState).toEqual({ source: EDIT.source, content: "<tt>2</tt>" });
  });

  describe("invariants", () => {
    it("is not an undo step", () => {
      const before = useProjectStore.getState().history.length;
      useProjectStore.getState().setTtmlEditState(EDIT);
      expect(useProjectStore.getState().history).toHaveLength(before);
      expect(useProjectStore.getState().canUndo()).toBe(false);
    });

    it("leaves the state untouched when the updater returns the current edit", () => {
      useProjectStore.getState().setTtmlEditState(EDIT);
      useProjectStore.getState().markClean();
      const before = useProjectStore.getState();
      useProjectStore.getState().setTtmlEditState((prev) => prev);
      expect(useProjectStore.getState()).toBe(before);
      expect(useProjectStore.getState().isDirty).toBe(false);
    });

    it("leaves the state untouched when clearing an edit that is already clear", () => {
      useProjectStore.getState().setTtmlEditState(null);
      useProjectStore.getState().markClean();
      const before = useProjectStore.getState();
      useProjectStore.getState().setTtmlEditState(null);
      expect(useProjectStore.getState()).toBe(before);
      expect(useProjectStore.getState().isDirty).toBe(false);
    });
  });

  describe("clearing", () => {
    it("is cleared by a project reset", () => {
      useProjectStore.getState().setTtmlEditState(EDIT);
      useProjectStore.getState().reset();
      expect(useProjectStore.getState().ttmlEditState).toBeNull();
    });

    it("is cleared by a lyrics import", () => {
      useProjectStore.getState().setTtmlEditState(EDIT);
      useProjectStore.getState().replaceLyricsWithHistory({
        lines: [createLine({ text: "New" })],
        groups: [],
        agents: undefined,
        metadata: {},
      });
      expect(useProjectStore.getState().ttmlEditState).toBeNull();
    });
  });
});
