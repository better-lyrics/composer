import { useProjectStore } from "@/stores/project";
import { createWord } from "@/test/factories";
import {
  movePointer,
  pressEdge,
  releasePointer,
  renderStretchTrack,
  storeWords,
} from "@/views/timeline/word-track.stretch-harness";
import { describe, expect, it } from "vitest";

// Regressions for two logic bugs found in the original stretch gesture, both
// reproduced deterministically through the real WordTrack gesture.

describe("WordTrack selection stretch regressions", () => {
  it("regression: keeps a mid-drag undo when the drag continues", async () => {
    const sA = [
      createWord({ text: "我 ", begin: 0, end: 1 }),
      createWord({ text: "爱 ", begin: 1, end: 2 }),
      createWord({ text: "你", begin: 5, end: 6 }),
    ];
    const { blocks, lineId } = await renderStretchTrack(sA, [0, 1]);

    // Commit an edit (only the unselected word[2] moves) so there is a real
    // undo target that differs from the pre-drag state.
    const sB = [sA[0], sA[1], { ...sA[2], end: 7 }];
    useProjectStore.getState().updateLinesWithHistory([{ id: lineId, updates: { words: sB } }], {
      propagateToSiblings: false,
    });

    pressEdge(blocks[1], "right");
    movePointer(100);
    // Undo mid-drag, then keep dragging: the gesture must yield to the undo, not
    // clobber it and commit a stretch over the undone state.
    useProjectStore.getState().undo();
    movePointer(150);
    releasePointer(150);

    const final = storeWords();
    expect(final[1].end).toBeCloseTo(2, 5);
    expect(final[2].end).toBeCloseTo(6, 5);
  });

  it("regression: a re-entrant drag baselines off committed state, not a transient", async () => {
    const l0 = [
      createWord({ text: "我 ", begin: 0, end: 1 }),
      createWord({ text: "爱 ", begin: 1, end: 2 }),
      createWord({ text: "你", begin: 5, end: 6 }),
    ];
    const { blocks } = await renderStretchTrack(l0, [0, 1]);

    // Gesture A leaves a transient preview in the store, then a second pointerdown
    // (multi-touch / stuck pointer) starts gesture B before A finishes.
    pressEdge(blocks[1], "right");
    movePointer(100);
    pressEdge(blocks[1], "right");
    movePointer(100);
    releasePointer(100);

    // The commit is a single stretch of the committed baseline (k = 3 / 2 = 1.5),
    // not a double stretch of gesture A's phantom preview.
    const final = storeWords();
    expect(final[0].end).toBeCloseTo(1.5, 5);
    expect(final[1].end).toBeCloseTo(3, 5);
    expect(final[2].begin).toBeCloseTo(5, 5);
    expect(final[2].end).toBeCloseTo(6, 5);

    // Undo lands on the real baseline, never a state that was only ever transient.
    useProjectStore.getState().undo();
    const undone = storeWords();
    expect(undone[1].end).toBeCloseTo(2, 5);
  });
});
