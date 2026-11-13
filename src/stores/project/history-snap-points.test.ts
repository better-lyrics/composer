import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";
import { pasteLyrics } from "@/domain/commands/edit-text";

describe("project history snapshots snap points", () => {
  beforeEach(() =>
    useProjectStore.setState({
      lines: [createLine({ text: "a" })],
      customSnapPoints: [],
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    }),
  );

  it("undo/redo restore the snap points captured in each history entry", () => {
    const store = useProjectStore.getState();
    store.commit(pasteLyrics(useProjectStore.getState().lines, [createLine({ text: "a2" })])); // entry captures customSnapPoints: []
    useProjectStore.getState().setCustomSnapPoints([9]); // non-history change
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [createLine({ text: "a3" })])); // entry captures [9]

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([]);

    useProjectStore.getState().redo();
    expect(useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([9]);
  });
});
