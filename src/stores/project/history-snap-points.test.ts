import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";

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
    store.setLinesWithHistory([createLine({ text: "a2" })]); // entry captures customSnapPoints: []
    useProjectStore.getState().setCustomSnapPoints([9]); // non-history change
    useProjectStore.getState().setLinesWithHistory([createLine({ text: "a3" })]); // entry captures [9]

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().customSnapPoints).toEqual([]);

    useProjectStore.getState().redo();
    expect(useProjectStore.getState().customSnapPoints).toEqual([9]);
  });
});
